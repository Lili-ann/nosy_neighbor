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
    
    "p1": {"x":5, "y":10, "hp": 6}, #player 1 starts at the bottom middle of the grid, with 6 hp
    
    "p2": {"x":5, "y":0, "hp": 6},  #player 2 starts at the top middle of the grid, with 6 hp
}

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
        state["status"] = "playing"
        
        #save to redis
    r.set('game_state', json.dumps(state))
    emit('game_update', state, broadcast=True)    

#to start the server
if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
