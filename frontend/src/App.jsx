import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

//connection to backend - flask
const socket = io('http://localhost:5000');

function App() {
//gameState starts empty until Python sends the data
  const [gameState, setGameState] = useState(null);  
  const [myPlayerId, setMyPlayerId] = useState(null); //to track if this device is P1 or P2

  //creating grid for board
  const gridSize =11;
  const totalcells = gridSize * gridSize;


  useEffect(() => {
    const handleConnect = () => {
    //react asks backend for the board
    socket.emit('join_game');
   };

   const handleGameUpdate = (newState) => {
    setGameState(newState);
   };

   socket.on('connect', handleConnect);

   //backend sends the board to react
   socket.on('game_update', handleGameUpdate);

   if (socket.connected) {
    handleConnect();
   }

   ////cleanup function to to remove listeners when you close the tab
   return () => {
    socket.off('connect', handleConnect);
    socket.off('game_update', handleGameUpdate);
    };
  }, []); //empty brackets mean "only run this setup ONE time when the page loads"


  //when a player is selected, ID gets locked and sent to backend to claim it.
  const handleChoosePlayer = (playerId) => {
    setMyPlayerId(playerId);
    socket.emit('claim_player', playerId);
  }; 
  if (!gameState)
    return <div className="lobby-container">
      <h2>Loading game...</h2></div>;




// ===============================THE LOBBY SCREEN - CHOOSE YOUR PLAYER=================================================
if (!myPlayerId) {
  return (
    <div className="lobby-container">
      <h1>Welcome to Nosy Neighbor!</h1>
      <h2>Choose your player:</h2>
    <div style={{ display: 'flex', gap: '20px', margin: '20px' }}>

{/*the buttons get disabled when its already taken */}
      <button
       onClick={() => handleChoosePlayer('p1')}
       disabled={gameState.p1_claimed}
       style={{ backgroundColor: '#3498db', color: 'white', padding: '10px 20px', 
        border: 'none', borderRadius: '5px', cursor: 'pointer' }}
       >{gameState.p1_claimed ? 'P1 Taken' : 'Player 1 (Blue)'}
       </button>

      <button 
      onClick={() => handleChoosePlayer('p2')}
      disabled={gameState.p2_claimed}
      style={{ backgroundColor: '#e74c3c', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
      >{gameState.p2_claimed ? 'P2 Taken' : 'Player 2 (Red)'}
      </button>

    </div>
    </div>
  );
}

//=========================WAITING ROOM - WAIT FOR OTHER PLAYER TO JOIN===========================================
if (gameState.status === 'waiting_for_players') {
  return(
    <div className="waiting-room">
      <h1 style={{ fontSize: '3rem', marginBottom: '20px', textAlign: 'center'}}>Nosy Neighbor</h1>
      <div style={{
        padding: '20px',
        backgroundColor: '#f0f0f0',
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        maxWidth: '400px',
        border: `4px solid ${myPlayerId === 'p1' ? '#3498db' : '#e74c3c'}`}}> 
        <h2>You are {myPlayerId}</h2>
      <h3 style={{marginTop: '20px', animation: 'pulse 1.5s infinite'}}>Waiting for other player to join...</h3>
  </div>
  </div>
  );
}



// ===============================THE GAME BOARD SCREEN===============================================

 const cells =[];
 // this will loop 121 times to create the grid cells.
  for (let i = 0; i < totalcells; i++) {
    //to calculte the x and y coordinates of each cell based on its index
    const x = i % gridSize;
    const y = Math.floor(i / gridSize);

    let cellClass = "grid-cell"; //default class for all cells
    let cellText = ""; //default text for all cells
  

  //check if backend has given the board data.
  if (gameState) {
    if(gameState.p1.x === x && gameState.p1.y === y) {
      cellClass = "grid-cell cell-p1"; 
      cellText = "P1";
    }

    else if(gameState.p2.x === x && gameState.p2.y === y) {
      cellClass = "grid-cell cell-p2"; 
      cellText = "P2";
    }
  }

    cells.push(
      <div key={i} className={cellClass}>
        {cellText}
      </div>  
    );
}

  return (
    <div className="game-container">
      <h1 style={{ marginBottom: '20px' }}>Nosy Neighbor</h1>

      <h2 style={{ marginBottom: '10px'}}>You are: {myPlayerId === 'p1' ? 'Player 1 (Blue)' : 'Player 2 (Red)'}</h2>

      {/* Game Board */}
      <div className="board">
        {cells}
      </div>

      </div>
    
  );

}
export default App;
