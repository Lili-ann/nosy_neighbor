import json
import redis
import pika    #translator to talk to rabbitmq
from flask import Flask
from flask_socketio import SocketIO
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
    return "Nosy Neighbosr Backend is running"

DEFAULT_GAME_STATE ={
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
        socketio.emit('game_update', json.loads(state))


#to start the server
if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)