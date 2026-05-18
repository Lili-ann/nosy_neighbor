import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

//connection to backend - flask
const socket = io('http://localhost:5000');

function App() {
  const [isConencted, setISConnected] = useState(false);
  useEffect(() => {
    //listen to connection event from Flask backend
    socket.on('connect', () => {
      setISConnected(true);
      console.log('Nosy Neighbot is connected to Backend!');
    });

    //listen to disconnection event from Flask backend
    socket.on('disconnect', () => {
      setIsConencted(false);
      console.log('Nosy Neighbor is disconnected from backend')
    });

    //ensure conenction is closed after closing tab
    return () => {
      socket.off('connect');
      socket.off('disconnect');
    }

  }, []);

  return (
    <div className="App">
      <h1>Nosy Neighbor</h1>
      <p>backend status: {isConencted ? '🟢 Connected' : '🔴 Disconnected'}</p>
    </div>
  )
}

export default App;