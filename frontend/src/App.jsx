import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

//connection to backend - flask
const socket = io('http://localhost:5000');

function App() {


//gameState starts empty until Python sends the data
  const [gameState, setGameState] = useState(null);  
  const [myPlayerId, setMyPlayerId] = useState(null) 

  const [auditLogs, setAuditLogs] = useState([]); // State to hold audit logs
  const logsEndRef = useRef(null); // Ref to scroll to the bottom of the logs

  const [rematchRequested, setRematchRequested] = useState(null); // State to track if a rematch has been requested

  useEffect(() => {
    // Listen for new audit logs from the backend

    socket.on('new_audit_log', (log) => {
      setAuditLogs((prevLogs) => [...prevLogs, log]);
    });

    socket.on('clear_audit_logs', () => {
      setAuditLogs([]); // Clear logs when backend signals to clear (e.g., on rematch)
      setRematchRequested(null); // Reset rematch request state when starting a new game
    });

    socket.on('rematch_requested', (data) => {
      setRematchRequested(data.by_player);
    });

    return () => {
      socket.off('new_audit_log');
      socket.off('clear_audit_logs');
      socket.off('rematch_requested');
    };
  }, []);


  useEffect(() => {
    // Scroll to the bottom of the logs when a new log is added
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [auditLogs]);
  
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

      if (e.code === 'Space') {
        e.preventDefault();
        handleUsePowerup('bomb'); //spacebar uses bomb powerup
      }
      if (e.key === 'Shift') {
        e.preventDefault();
        handleUsePowerup('boots'); //shift button uses boots powerup
      }
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



// ----------------------------------handle powerup usage------------------------------
  const handleUsePowerup = (item) => {

    if (gameState.turn === myPlayerId) {
      socket.emit('use_powerup', { player: myPlayerId, item: item });
    }
};

//-----------------------------handle play again button------------------------------
  const handlePlayAgain = () => {
    socket.emit('play_again', { player: myPlayerId });

    setAuditLogs([]); //clear audit logs when starting a new game
  };
 


//-----------------------------handle reset server button------------------------------
  const handleResetServer = () => {
    //warning popup message
    if (window.confirm("Are you sure you want to start New Game?")) {
      socket.emit('reset_server');
      setMyPlayerId(null); //reset local player ID to go back to lobby screen

      setAuditLogs([]); //clear audit logs when starting a new game
    }
  };
// ===============================THE LOBBY SCREEN - CHOOSE YOUR PLAYER=================================================
if (!myPlayerId) {
  return (
    <div className="lobby-container">
      <h1>Welcome to Nosy Neighbor!</h1>
      {/*----------------------new game button-------------------------------*/}
      <button
      onClick={handleResetServer}
      style={{ marginTop: '20px', padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', borderRadius: '5px', border: 'none', backgroundColor: '#c0392b', color: 'white' }}
      >Start New Game</button>
      {/*---------------------------------------------------------------------------------*/}

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

const getItemEmoji = (item) => {
  if (item === "bomb") return "💣";
  if (item === "boots") return "👢";
  if (item === "medkit") return "💊";
  return item;
};


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

    //check for walls and medkits
    const isWall = gameState.walls.some(spot => spot.x === x && spot.y === y);
    const isMedkit = gameState.medkit && gameState.medkit.x === x && gameState.medkit.y === y;


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
    } else if (isWall) {
      //wall
      cellClass = "grid-cell cell-wall";
      cellText = "🧱";
    } else if (isMedkit) {
      //medkit
      cellClass = "grid-cell cell-medkit";
      cellText = "💊";
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', marginBottom: '20px', backgroundColor: '#f8f9fa', padding: '15px 30px', borderRadius: '10px', border: '1px solid #ddd' }}>
        
        {/* Player 1 HP */}
        <div>
          <span style={{ color: '#3498db', fontWeight: 'bold', fontSize: '1.2rem'}}>Player 1 HP:</span>
          <span style={{ fontSize: '1.5rem', marginLeft: '10px', color:'black' }}>  
          {gameState.p1.hp > 0 ? '💓'.repeat(gameState.p1.hp) : '💀'} ({gameState.p1.hp}/3)
          </span>
        </div>
  
        <div style={{ borderLeft: '2px solid #ccc', height: '30px'}}></div>

        {/* Player 2 HP */}
        <div>
          <span style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '1.2rem'}}>Player 2 HP:</span>
          <span style={{ fontSize: '1.5rem', marginLeft: '10px', color:'black'  }}>
          {gameState.p2.hp > 0 ? '💓'.repeat(gameState.p2.hp) : '💀'} ({gameState.p2.hp}/3)
          </span>
        </div>  

        <div style={{ borderLeft: '2px solid #ccc', height: '30px'}}></div>

        {/* Reset Game Button */}
        <button 
          onClick={handleResetServer}
          style={{ 
            padding: '8px 16px', 
            fontSize: '0.9rem', 
            cursor: 'pointer', 
            borderRadius: '6px', 
            border: 'none', 
            backgroundColor: '#7f8c8d', 
            color: 'white', 
            fontWeight: 'bold',
            transition: '0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#c0392b'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#7f8c8d'}
        >
          🔄 Reset Game
        </button>

      </div>

     
  {/* ---------------------------------GAME OVER SCREEN------------------------------- */}
  {gameState.status === 'game_over' ? (
    <div style={{ backgroundColor: '#ffcccc', padding: '20px', borderRadius: '8px', border: '2px solid #ff0000', marginBottom: '20px', textAlign: 'center' }}>
      <h2 style={{ color: '#cc0000', margin: '0 0 15px 0', animation: 'pulse 1.5s infinite' }}>
        🚨 GAME OVER! {gameState.winner === 'p1' ? 'Player 1 Wins!' : 'Player 2 Wins!'} 🚨
      </h2>
      
      {/* The Play Again Button */}
      <button 
        onClick={handlePlayAgain}
        style={{ padding: '10px 25px', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '8px', border: 'none', backgroundColor: '#c0392b', color: 'white', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
      > 🔄 Play Again
      </button>
    </div>
   ) : (

     <h3 style={{ marginBottom: '20px' }}>
       {gameState.turn === myPlayerId ? "Your turn!" : "Opponent's turn..."}
     </h3>
   )}
      

{/* ----------------------Game Board & Drawers Layout------------------------------- */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '30px' }}>
        
        {/* Left Side: Player 1's Sidebar (Drawer + Audit Log) */}
        {myPlayerId === 'p1' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            {/* P1 Drawer */}
            <div style={{ width: '150px', backgroundColor: '#eef2f5', padding: '15px', borderRadius: '8px', border: '2px solid #3498db' }}>
              <h3 style={{ color: '#3498db', textAlign: 'center', marginBottom: '10px' }}>Your Drawer</h3>
              {gameState.p1_inventory.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#7f8c8d' }}>Empty</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {gameState.p1_inventory.map((item, index) => (
                    <li 
                      key={index} 
                      onClick={() => handleUsePowerup(item)}
                      style={{ 
                        backgroundColor: '#fff', padding: '8px', borderRadius: '5px', 
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center', fontWeight: 'bold',
                        cursor: gameState.turn === myPlayerId ? 'pointer' : 'not-allowed',
                        border: '2px solid transparent', transition: '0.2s'
                      }}
                    >
                      {getItemEmoji(item)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* P1 Audit Log */}
            <div style={{ width: '280px', height: '380px', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                <div style={{ backgroundColor: '#0f172a', color: '#34d399', padding: '12px', fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                    LIVE AUDIT LOG
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', fontSize: '12px', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {auditLogs.length === 0 ? (
                        <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>Waiting for events...</div>
                    ) : (
                        auditLogs.map((log, index) => (
                            <div key={index} style={{ borderLeft: '2px solid #10b981', paddingLeft: '12px' }}>
                                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>[{log.player.toUpperCase()}]</span> 
                                <span style={{ color: '#cbd5e1', marginLeft: '8px' }}>{log.action}</span>
                                <div style={{ color: '#64748b', marginTop: '4px' }}>{log.details}</div>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
          </div>
        )}
      
        {/* Center: The actual Game Board */}
        <div className={`board ${myPlayerId === 'p2' ? 'board-rotated' : ''}`}>
          {cells}
        </div>

        {/* Right Side: Player 2's Sidebar (Drawer + Audit Log) */}
        {myPlayerId === 'p2' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            {/* P2 Drawer */}
            <div style={{ width: '150px', backgroundColor: '#fdf1f0', padding: '15px', borderRadius: '8px', border: '2px solid #e74c3c' }}>
              <h3 style={{ color: '#e74c3c', textAlign: 'center', marginBottom: '10px' }}>Your Drawer</h3>
              {gameState.p2_inventory.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#7f8c8d' }}>Empty</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {gameState.p2_inventory.map((item, index) => (
                    <li 
                      key={index} 
                      onClick={() => handleUsePowerup(item)}
                      style={{ 
                        backgroundColor: '#fff', padding: '8px', borderRadius: '5px', 
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center', fontWeight: 'bold',
                        cursor: gameState.turn === myPlayerId ? 'pointer' : 'not-allowed',
                        border: '2px solid transparent', transition: '0.2s'
                      }}
                    >
                      {getItemEmoji(item)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* P2 Audit Log */}
            <div style={{ width: '280px', height: '380px', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                <div style={{ backgroundColor: '#0f172a', color: '#34d399', padding: '12px', fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                    LIVE AUDIT LOG
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', fontSize: '12px', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {auditLogs.length === 0 ? (
                        <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>Waiting for events...</div>
                    ) : (
                        auditLogs.map((log, index) => (
                            <div key={index} style={{ borderLeft: '2px solid #10b981', paddingLeft: '12px' }}>
                                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>[{log.player.toUpperCase()}]</span> 
                                <span style={{ color: '#cbd5e1', marginLeft: '8px' }}>{log.action}</span>
                                <div style={{ color: '#64748b', marginTop: '4px' }}>{log.details}</div>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
          </div>
        )}

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
