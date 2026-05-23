import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

//connection to backend - flask
const socket = io('http://localhost:5000');

function App() {
//gameState starts empty until Python sends the data
  const [gameState, setGameState] = useState(null);  
  const [myPlayerId, setMyPlayerId] = useState(null) 
  
  //-----------------------handling movement logic---------------------------
  const handleMove = (direction) => {
    //send message only if its actuall the players turn
    if (gameState.turn === myPlayerId) {
      socket.emit('move_player', { player: myPlayerId, direction: direction });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameState || gameState.turn !== myPlayerId) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); //prevent default scrolling behavior
      }

      if (e.key === 'ArrowUp') socket.emit('move_player', { player: myPlayerId, direction: 'forward' });
      if (e.key === 'ArrowDown') socket.emit('move_player', { player: myPlayerId, direction: 'backward' });
      if (e.key === 'ArrowLeft') socket.emit('move_player', { player: myPlayerId, direction: 'left' });
      if (e.key === 'ArrowRight') socket.emit('move_player', { player: myPlayerId, direction: 'right' });

    };

      // tell browers to listen for key pressed
    window.addEventListener('keydown', handleKeyDown);
    
    //cleanup function to stop listening when game ends.
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, myPlayerId]);; //to track if this device is P1 or P2

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

//-------------------------------------------------------------------------------------------------------
  //when a player is selected, ID gets locked and sent to backend to claim it.
  const handleChoosePlayer = (playerId) => {
    setMyPlayerId(playerId);
    socket.emit('claim_player', playerId);
  }; 
  if (!gameState)
    return <div className="lobby-container">
      <h2>Loading game...</h2></div>;
    
  
//-----------------------------handle the RPS choice ------------------------------
// The backend will then determine the winner and update the game state accordingly.
  const handleRpsChoice = (choice) => {
    socket.emit('play_rps', { player: myPlayerId, choice: choice });
  };


 



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

//==============================THE RPS SCREEN - CHOOSE YOUR MOVE=================================================
if (gameState.status === 'rps') {
  const myChoice = myPlayerId ==='p1' ? gameState.p1_rps : gameState.p2_rps;

  return(
    <div className="rps-container">
      <h1 style={{ fontSize: '3rem', marginBottom: '20px', textAlign: 'center'}}>Nosy Neighbor</h1>
      <h2> Mini-Game: Who gets to go First? </h2>
    
    {/* RPS buttons */}
    {!myChoice ? (
      <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
        <button onClick={() => handleRpsChoice('rock')} style={{ padding: '10px 20px', fontSize: '1.2rem', border: 'none', backgroundColor: '#95a5a6', cursor: 'pointer' }}>Rock</button>
        <button onClick={() => handleRpsChoice('paper')} style={{ padding: '10px 20px', fontSize: '1.2rem', border: 'none', backgroundColor: '#95a5a6', cursor: 'pointer' }}>Paper</button>
        <button onClick={() => handleRpsChoice('scissors')} style={{ padding: '10px 20px', fontSize: '1.2rem', border: 'none', backgroundColor: '#95a5a6', cursor: 'pointer' }}>Scissors</button>
      </div>
    ) : (
      /*hide buttons if players have choosen*/
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <h3>Your choice: {myChoice.toUpperCase()} </h3>
        <p style={{ animation: 'pulse 1.5s infinite', marginTop: '10px', fontSize:'1.2rem' }}>
          Waiting for opponent to choose...
          </p>
    </div>
  )}
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
    // players base
    const isP1Base = (x === 5 && y === 10);
    const isP2Base = (x === 5 && y === 0);


   // 1. Check if the cell is the actual Player
    if (gameState.p1.x === x && gameState.p1.y === y) {
      cellClass = "grid-cell cell-p1"; 
      cellText = "P1";
    } else if (gameState.p2.x === x && gameState.p2.y === y) {
      cellClass = "grid-cell cell-p2"; 
      cellText = "P2";
    } else if (isP1Base) {
      //player 1 base
      cellClass = "grid-cell cell-base-p1";
      cellText = "🚩";
    } else if (isP2Base) {
      //player 2 base
      cellClass = "grid-cell cell-base-p2";
      cellText = "🚩";
    }
    else {
      // 2. If it's not the player, check if it's a Trail!
      const isP1Trail = gameState.p1_trail.some(spot => spot.x === x && spot.y === y);
      const isP2Trail = gameState.p2_trail.some(spot => spot.x === x && spot.y === y);

      if (isP1Trail) {
        cellClass = "grid-cell cell-trail-p1";
      } else if (isP2Trail) {
        cellClass = "grid-cell cell-trail-p2";
      }
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

      {/* ------------------------Game Status and HP system------------------------- */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginBottom: '20px', backgroundColor: 'f8f9fa', padding: '15px 30px', borderRadius: '10px', border: '1px solid #ddd' }}>
        <div>
          <span style={{ color: '-moz-initial', fontWeight: 'bold', fontSize: '1.2rem'}}>Player 1 HP:</span>
          <span style={{ fontSize: '1.5rem', marginLeft: '10px' }}>  
          {gameState.p1_hp > 0 ? '💓'.repeat(gameState.p1_hp) : '💀'} ({gameState.p1.hp}/6)
          </span>
        </div>
  
        <div style={{ borderLeft: '2px solid #ccc'}}></div>

        <div>
          <span style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '1.2rem'}}>Player 2 HP:</span>
          <span style={{ fontSize: '1.5rem', marginLeft: '10px' }}>
          {gameState.p2_hp > 0 ? '💓'.repeat(gameState.p2_hp) : '💀'} ({gameState.p2.hp}/6)
          </span>
        </div>  
        </div>
     
  {/* ---------------------------------GAME OVER SCREEN------------------------------- */}
  {gameState.status === 'game_over' ? (
    <div style={{ backgroundColor: '#f8d7da', padding: '20px', borderRadius: '10px', border: '1px solid #f5c6cb', marginBottom: '20px' }}>
     <h2 style={{ color: '#cc0000', margin: 0, animation: 'pulse 1.5s infinite' }}>
          🚨 GAME OVER! {gameState.winner === 'p1' ? 'Player 1 Wins!' : 'Player 2 Wins!'} 🚨
        </h2>
    </div>
   ) : (

     <h3 style={{ marginBottom: '20px' }}>
       {gameState.turn === myPlayerId ? "Your turn!" : "Opponent's turn..."}
     </h3>
   )}
      

{/* ----------------------Game Board------------------------------- */}
      <div className={`board ${myPlayerId === 'p2' ? 'board-rotated' : ''}`}>
        {cells}
      </div>

{/* ----------------------Movement Controls------------------------------- */}
      <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>

      {/* the forward button */}
      <button 
        onClick={() => handleMove('forward')}
        disabled={gameState.turn !== myPlayerId}
        style={{ padding: '10px 20px', fontSize: '40px', cursor: gameState.turn === myPlayerId ? 'pointer' : 'not-allowed', borderRadius: '8px', border: 'none', backgroundColor: gameState.turn === myPlayerId ? '#2ecc71' : '#7f8c8d', color: 'white' }}
        >⬆️
      </button>

      <div styles={{ display: 'flex', gap: '60px' }}>

      {/* the left button */}
      <button 
        onClick={() => handleMove('left')}
        disabled={gameState.turn !== myPlayerId}
        style={{ padding: '10px 30px', fontSize: '40px', cursor: gameState.turn === myPlayerId ? 'pointer' : 'not-allowed', borderRadius: '8px', border: 'none', backgroundColor: gameState.turn === myPlayerId ? '#2ecc71' : '#7f8c8d', color: 'white' }}
        >⬅️
      </button>

      {/* the backward button */}
      <button 
        onClick={() => handleMove('backward')}
        disabled={gameState.turn !== myPlayerId}
        style={{ padding: '10px 30px', margin: '30px',  fontSize: '40px', cursor: gameState.turn === myPlayerId ? 'pointer' : 'not-allowed', borderRadius: '8px', border: 'none', backgroundColor: gameState.turn === myPlayerId ? '#2ecc71' : '#7f8c8d', color: 'white' }}
        >⬇️
      </button>

      {/* the right button */}   
      <button 
        onClick={() => handleMove('right')} 
        disabled={gameState.turn !== myPlayerId}
        style={{  padding: '10px 30px', fontSize: '40px', cursor: gameState.turn === myPlayerId ? 'pointer' : 'not-allowed', borderRadius: '8px', border: 'none', backgroundColor: gameState.turn === myPlayerId ? '#2ecc71' : '#7f8c8d', color: 'white' }}
      >➡️
      </button>

          </div>
      </div>
    </div> 
  );
}
 
export default App;
