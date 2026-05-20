import json
import redis
import pika    #translator to talk to rabbitmq
from flask import Flask
from flask_socketio import SocketIO, emit
from flask_cors import CORS   #cross origin resource sharing,


#initilaize the flask app and socketio
app = Flask(__name__)
CORS(app)     #it allows frontend to connect with backend even if they are on different domains or ports
socketio = SocketIO(app, cors_allowed_origins="*") #allows for realtime websocket communication between frontend and backend

#Conenct to redis
r = redis.Redis(host='localhost', port=6379,db=0, decode_responses=True)
#decode_reponses=True, allows us to get normal text instead of byteswhen we get the data from redis

#connect to Rabbitmq
connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

# queue -> malbox
channel.queue_declare(queue='game_moves')  
#queue name: game_moves, where the game moves are sent from the frontend to the backend



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
    
    #players territory on grid
    "p1": {"x":5, "y":10, "hp": 6}, #player 1 starts at the bottom middle of the grid, with 6 hp
    "p2": {"x":5, "y":0, "hp": 6},  #player 2 starts at the top middle of the grid, with 6 hp
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
            
        else:
            #player 2 wins the round, gets to move first
            state["turn"] = "p2"
            state["status"] = "playing"
        
    #save the updated game state to redis
    r.set('game_state', json.dumps(state))
    emit('game_update', state, broadcast=True)  #send the updated game state to
            
            
        


#to start the server
if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
