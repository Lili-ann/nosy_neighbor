from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS   #cross origin resource sharing,
import redis
import pika    #translator to talk to rabbitmq

app = Flask(__name__)
CORS(app)     #it allows frontend to connect with backend even if they are on different domains or ports
socketio = SocketIO(app, cors_allowed_origins="*")

#to test redis conenction
r = redis.Redis(host='localhost', port=6379,db=0)

@app.route('/')

def index():     #healthcheck endpoint to check if the backend is running
    return "Nosy Neighbosr Backend is running"

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)