import json
import redis
import pika
import random
from flask import Flask
from flask_socketio import SocketIO, emit
from flask_cors import CORS   #cross origin resource sharing,

from audit import rabbitmq_worker

#initilaize the flask app and socketio
app = Flask(__name__)
CORS(app)     #it allows frontend to connect with backend even if they are on different domains or ports
socketio = SocketIO(app, cors_allowed_origins="*") #allows for realtime websocket communication between frontend and backend

#Conenct to redis
r = redis.Redis(host='redis', port=6379,db=0, decode_responses=True)
#decode_reponses=True, allows us to get normal text instead of byteswhen we get the data from redis

# ============================== RABBITMQ ==============================
def publish_event(log_data):
    """Thread-safe helper to send a single message to RabbitMQ and close the door."""
    try:
        # Use 'rabbitmq' because we are running inside Docker
        temp_conn = pika.BlockingConnection(pika.ConnectionParameters('rabbitmq'))
        temp_channel = temp_conn.channel()
        temp_channel.queue_declare(queue='game_moves', durable=True)
        
        # Send the message
        temp_channel.basic_publish(exchange='', routing_key='game_moves', body=json.dumps(log_data))
        
        socketio.emit('new_audit_log', log_data)  # Send the log data to the frontend in real-time
        
        # Safely close the connection
        temp_conn.close()
    except Exception as e:
        print(f"Failed to publish to RabbitMQ: {e}", flush=True)
# =============================================================================


@app.route('/')
def index():     #healthcheck endpoint to check if the backend is running
    return "Nosy Neighbor Backend is running"

DEFAULT_GAME_STATE ={
    "status": "waiting_for_players", #game starts in a waiting state until both players have joined
    "p1_claimed": False,
    "p2_claimed": False,
    
    #memory of RPS game, to determine the winner of each move
    "p1_rps": None,
    "p2_rps": None,
    "turn": None,
    "winner": None,
    
    "p1_inventory": [],  #storing player1 powerups
    "p2_inventory": [], #storing player2 powerups
    "walls": [],  #randomly placed wall positions
    "medkit": None, #randomly placed one medkit position
    
    "p1_extra_turn": False, #track if player has an extra turn from boots powerup
    "p2_extra_turn": False,
    
    #memory for player's trail path
    "p1_trail": [],
    "p2_trail": [],
    
    #players territory on grid
    "p1": {"x":5, "y":10, "hp": 3}, #player 1 starts at the bottom middle of the grid, with 6 hp
    "p2": {"x":5, "y":0, "hp": 3},  #player 2 starts at the top middle of the grid, with 6 hp
    
    'p1_wants_rematch': False,
    'p2_wants_rematch': False
}

#===============================MOVEMENT CONTROLL===============================
MOVEMENT_LOGIC ={
    "p1": {
        "forward": {"x": 0, "y": -1},    #p1 moves up the grid
        "left": {"x": -1, "y": 0},
        "backward": {"x": 0, "y": 1},
        "right": {"x": 1, "y": 0}
    },
    "p2": {
        "forward": {"x": 0, "y": 1},         #moves down the grid
        "left": {"x": 1, "y": 0},
        "backward": {"x": 0, "y": -1},
        "right": {"x": -1, "y": 0}
            
    }
}

#==============================Game State Management===========================

@socketio.on('join_game')
def handle_join(data=None):
    print("A player has joined the game.")
    
    #to check id a game is saved in Redis
    state = r.get('game_state')
    
    #if there is no game, creates a new one using the default game state
    if not state:
        r.set('game_state', json.dumps(DEFAULT_GAME_STATE))
        state = r.get('game_state')

    #game state is sent to frontend.
    emit('game_update', json.loads(state), broadcast=True)  #broadcast=True, means that the game state will be sent to all connected clients, not just the one that triggered the event
        
    
    
#==============================Player Selection Logic===========================
@socketio.on('claim_player')
def handle_claim(player_id):
    state = json.loads(r.get('game_state'))
    
    #lock player selection so that only one player can claim p1 and the other can claim p2
    if player_id == "p1":
        state["p1_claimed"] = True
        
    elif player_id == "p2":
        state["p2_claimed"] = True
        
    #if both players are choosen, game starts 
    if state["p1_claimed"] and state ["p2_claimed"]:
        state["status"] = "rps"
        
        #save to redis
    r.set('game_state', json.dumps(state))
    emit('game_update', state, broadcast=True)    

@socketio.on('unclaim_player')
def handle_unclaim(player_id):
    state = json.loads(r.get('game_state'))

    if state["status"] == "waiting_for_players":
        if player_id == "p1":
            state["p1_claimed"] = False
        elif player_id == "p2":
            state["p2_claimed"] = False

        r.set('game_state', json.dumps(state))
        emit('game_update', state, broadcast=True)

#==============================RPS Logic===========================

@socketio.on('play_rps')
def handle_rps(data):
    state = json.loads(r.get('game_state'))
    player = data['player']
    choice = data['choice']
    
    #saves players choice to the game state
    if player == "p1":
        state["p1_rps"] = choice
    elif player == "p2":
        state["p2_rps"] = choice
        
    #check if both players have made their choice
    if state["p1_rps"] and state["p2_rps"]:
        p1 = state["p1_rps"]
        p2 = state["p2_rps"]
        
        #determine the winner of the RPS round
        if p1 == p2:
            #if it's a tie, reset choices.
            state["p1_rps"] = None
            state["p2_rps"] = None
            
        elif (p1 =="rock" and p2 == "scissors") or \
            (p1 == "scissors" and p2 == "paper") or \
            (p1 == "paper" and p2 == "rock"):
            #player 1 wins the round, gets to move first
            state["turn"] = "p1"                   
            state["status"] = "playing"
            state["p1_inventory"].append(random.choice(["bomb", "boots"]))
            
        else:
            #player 2 wins the round, gets to move first
            state["turn"] = "p2"
            state["status"] = "playing"
            state["p2_inventory"].append(random.choice(["bomb", "boots"]))
            
# ==============================WALLS AND MEDKITS LOGIC===========================
    #randomly place 5 walls and 1 medkit on the grid at the start of the game, only if they haven't been placed yet
    if state["status"] == "playing":
        #generate 5 -7 random wall positions
        
        num_walls = random.randint(5, 7)
        safe_zones = [{"x": 5, "y": 10}, {"x": 5, "y": 0}]  #walls are not placed close to players base
        
        while len(state["walls"]) < num_walls:
            spot ={"x": random.randint(0, 10), "y": random.randint(0, 10)}
            
            if spot not in safe_zones and spot not in state["walls"]:
                state["walls"].append(spot)
        
        #generate 1 random medkit position, not on a wall or safe zone
        while state["medkit"] is None:
            spot = { "x" : random.randint(0, 10), "y": random.randint(0, 10)}
            
            if spot not in safe_zones and spot not in state["walls"]:
                state["medkit"] = spot
    
    #save the updated game state to redis
    r.set('game_state', json.dumps(state))
    emit('game_update', state, broadcast=True)  #send the updated game state to
            
            
# ======================================MOVEMENT LOGIC==============================
@socketio.on('move_player')
def handle_move(data):
    state =json.loads(r.get('game_state'))
    player = data['player']
    direction = data['direction']
    
    #ignores move if its not player's turn or game is not playing.
    if state["status"] != "playing" or state["turn"] != player:
        return
    
    log_data = {"player": player, "action": "move", "details": direction}
    publish_event(log_data)
        
    #get current position
    current_x = state[player]["x"]
    current_y = state[player]["y"]
    
    #get specific player and direction movement logic
    math = MOVEMENT_LOGIC[player][direction]
    
    #calculate new position
    new_x = current_x + math["x"]
    new_y = current_y + math["y"]
    
    #check if new position is valid
    if 0 <= new_x <= 10 and 0 <= new_y <= 10:
        
        if {"x": new_x, "y": new_y} in state["walls"]:
            return #invalid move, player hit a wall, do not update position or switch turn
        
        
        #who is the opponent?
        opponent ="p2" if player == "p1" else "p1"
        opponent_trail = state[f"{opponent}_trail"]
        
        #drops breadc crumbs on current spot before moving, to create a trail
        
        current_spot = {"x": current_x, 'y': current_y}
        if current_spot not in state[f"{player}_trail"]:    # avoid saving the same coordinates again
            state[f"{player}_trail"].append(current_spot)
            
            
        for spot in opponent_trail:
            #checks if player stepped on opponent's trail
            if spot["x"] == new_x and spot["y"] == new_y:
                #lose 1 HP if stepped on opponent's trail
                state[player]["hp"] -= 1
                 
                #steal territory by removing the spot from opponent's trail and adding it to player's trail             
                opponent_trail.remove(spot)
                
                new_spot = {"x": new_x, "y": new_y}
                if new_spot not in state[f"{player}_trail"]:
                    state[f"{player}_trail"].append(new_spot)
                
                print(f"{player} stole {opponent}'s tile and lost 1 hp!") 
                break        
                
                steal_log ={
                    "player": player,
                    "action": "steal_tile",
                    "details": f"Stole territory from {opponent} at ({new_x}, {new_y})"
                }
                publish_event(steal_log)
                break
                              
            #if player did not step on enemy trail                     
            if not opponent_trail:
                state[f"{player}_trail"].append({"x": current_x, "y": current_y})    
        
        #if move is safe, player move to new position.
        state[player]["x"] = new_x
        state[player]["y"] = new_y
        
    # ------------------------------check for powerup pickups-----------------------------
        #check if player stepped on a medkit
        if state["medkit"] and new_x == state["medkit"]["x"] and new_y == state["medkit"]["y"]:
           if state[player]["hp"] < 3:
                #if HP is less than 3, heal 1 HP
                state[player]["hp"] += 1
                print(f"{player} picked up a medkit and healed 1 HP!")
                
                publish_event({"player": player, "action": "used_medkit","details": "+ 1 HP"})
           else:
               #store in player inventory if HP is already full
                state[f"{player}_inventory"].append("medkit")
                print(f"{player} picked up a medkit")
                
                publish_event({"player": player, "action": "pickup_medkit", "details": "medkit"})
                
           state["medkit"] = None  #remove medkit from the board after pickup
            
    #--------------------------------------------------------------------------------------------------- 
            
        #check if a player died (low hp)
        if state[player]["hp"] <= 0:
            state["status"] = "game_over"
            state["winner"] = opponent
            print(f"DEATH! {opponent} wins by knockout!")
            
        elif player =="p1" and new_x == 5 and new_y == 0:
            state["status"] = "game_over"
            state["winner"] = "p1"
            print("Player 1 Captured Player 2 Base!")
        
        elif player =="p2" and new_x == 5 and new_y == 10:
            state["status"] = "game_over"
            state["winner"] = "p2"
            print("Player 2 Captured Player 1 Base!")
            
 #===================================================================================           
    
            #switch players only when game is still playing.
        if state["status"] != "game_over":
            
            #did player use sprint boot
            if state.get(f"{player}_extra_turn"):
                state[f"{player}_extra_turn"] = False
                print(f"{player} used sprint boots got 2x turns!")
            else:        
                if player =="p1":
                    state["turn"] = "p2"
                else:
                    state["turn"] = "p1"
                    
        #save to redis
        r.set('game_state', json.dumps(state))
        emit('game_update', state, broadcast=True)
    
#======================================Powerup Logic===========================
@socketio.on('use_powerup')
def handle_powerup(data):
    state = json.loads(r.get('game_state'))
    player = data['player']
    item = data['item']
    
    #Is the game playing, and is it their turn?
    if state["status"] != "playing" or state["turn"] != player:
        return
    
    #Do they actually own the item?
    inventory = state[f"{player}_inventory"]
    if item not in inventory:
        return
    
    
    log_data = {"player": player, "action": "use_powerup", "details": item}
    publish_event(log_data)
    
    #remove item from inventory after use
    inventory.remove(item)
    
    #BOMB LOGIC
    if item =="bomb":
        opponent = "p2" if player == "p1" else "p1"
        px = state[player]["x"]
        py = state[player]["y"]
        

        surviving_trails =[]
        for spot in state[f"{opponent}_trail"]:
            if abs(spot["x"] - px) <= 1 and abs(spot["y"] - py) <= 1:
                pass
            else:
                surviving_trails.append(spot)
                
        state[f"{opponent}_trail"] = surviving_trails
        print(f"{player} used a bomb! {opponent}'s trail was damaged!")
        
        
        #BOOTS LOGIC
    elif item == "boots":
        state[f"{player}_extra_turn"] = True
        print(f"{player} used boots! They get an extra turn!")
        
    
    r.set('game_state', json.dumps(state))
    emit('game_update', state, broadcast=True)
                  
#==============================RESET GAME LOGIC===========================
@socketio.on('play_again')
def handle_play_again(data):
    state = json.loads(r.get('game_state'))
    player = data['player']
    #reset the game state to default
    
    if state["status"] == "game_over":
        state[f"{player}_wants_rematch"] = True
        r.set('game_state', json.dumps(state))
        
        if state.get('p1_wants_rematch') and state.get('p2_wants_rematch'):
            #players go back to RPS
            state['status'] = "rps"
            
            #Delete previous game state data
            state['p1_rps'] = None
            state['p2_rps'] = None
            state['turn'] = None
            state['winner'] = None
            
            state['p1_inventory'] = []
            state['p2_inventory'] = []
            state['walls'] = []
            state['medkit'] = None
            
            state['p1_extra_turn'] = False
            state['p2_extra_turn'] = False
            
            state['p1_trail'] = []
            state['p2_trail'] = []
            
            #reset position and HP
            state['p1'] = {"x":5, "y":10, "hp": 3}
            state['p2'] = {"x":5, "y":0, "hp": 3}
            
            state['p1_wants_rematch'] = False
            state['p2_wants_rematch'] = False
                
            #save to redis
            r.set('game_state', json.dumps(state))
            emit('game_update', state, broadcast=True)
            socketio.emit('clear_audit_logs')  # Tell frontend to clear audit logs for the new game
            print("🔄 REMATCH INITIATED! Board cleared.")
            
        else:
            socketio.emit('rematch_requested', {"by_player": player})
    

#==============================SERVER RESET==============================
@socketio.on('reset_server')
def handle_reset_server():
    #clear the game state from redis
    r.set('game_state', json.dumps(DEFAULT_GAME_STATE)) 

    state = json.loads(r.get('game_state'))
    emit('game_update', state, broadcast=True)  #send the reset game state to everyone
    socketio.emit('clear_audit_logs')  # Tell frontend to clear audit logs for the new game
    
    socketio.emit('kick_to_lobby')  # Tell frontend to kick everyone back to the lobby screen
    
    print("New Game: Game state cleared and set to default.")
                        

#to start the server
if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
