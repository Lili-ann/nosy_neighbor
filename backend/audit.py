import pika
import json
import sys

#=================================Rabbitmq Audit===============================
def rabbitmq_worker():
    """Runs continuously, listening for the game events to log """    
    try:
        # Use 'rabbitmq' because we are running inside Docker
        worker_conn = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
        worker_channel = worker_conn.channel()
        worker_channel.queue_declare(queue='game_moves')
        
        def callback(ch, method, properties, body):
            event = json.loads(body)
            # flush=True forces Docker to print the log instantly
            print(f" X [RabbitMQ Audit logs]: {event['player']} | Action: {event['action']} | Details: {event['details']}", flush=True)
        
        worker_channel.basic_consume(queue='game_moves', on_message_callback=callback, auto_ack=True)
        
        print("RabbitMQ Audit Worker started, listening for game moves... (Press CTRL+C to quit)", flush=True)
        
        # This is a blocking loop. It will run forever!
        worker_channel.start_consuming()
        
    except Exception as e:
        print(f"RabbitMQ Worker Error: {e}", flush=True)
   
# Start the worker directly when this file is executed
if __name__ == '__main__':
    try:
        rabbitmq_worker()
    except KeyboardInterrupt:
        print("\nAudit Worker shut down gracefully.", flush=True)
        sys.exit(0)