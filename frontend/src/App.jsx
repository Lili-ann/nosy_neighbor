import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

//connection to backend - flask
const socket = io(`http://${import.meta.env.VITE_SERVER_ID}:5000`);

function App() {
  const [gameStarted, setGameStarted] = useState(false); // State to track if the game has started

//gameState starts empty until Python sends the data
  const [gameState, setGameState] = useState(null);  
  const [myPlayerId, setMyPlayerId] = useState(null) 

  const [showTransition, setShowTransition] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const prevStatusRef = useRef(null);

  const [auditLogs, setAuditLogs] = useState([]); // State to hold audit logs
  const logsEndRef = useRef(null); // Ref to scroll to the bottom of the logs

  const [rematchRequested, setRematchRequested] = useState(null); // State to track if a rematch has been requested
  const [hoveredPlayer, setHoveredPlayer] = useState(null); // State to track which player image is hovered

  useEffect(() => {
// Listen for new audit logs from the backend
    socket.on('new_audit_log', (log) => {
      setAuditLogs((prevLogs) => [...prevLogs, log]);
    });

// Clear logs when backend signals to clear (e.g., on rematch)
    socket.on('clear_audit_logs', () => {
      setAuditLogs([]); 
      setRematchRequested(null); 
    });

// Reset rematch request state when starting a new game
    socket.on('rematch_requested', (data) => {
      setRematchRequested(data.by_player);
    });

    socket.on('kick_to_lobby', () => {
      setMyPlayerId(null);
    });

    return () => {
      socket.off('new_audit_log');
      socket.off('clear_audit_logs');
      socket.off('rematch_requested');
      socket.off('kick_to_lobby');
    };
  }, []);


  useEffect(() => {
    // Scroll to the bottom of the logs when a new log is added
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [auditLogs]);


  useEffect(() => {
    if (gameState) {
      if (prevStatusRef.current === 'rps' && gameState.status === 'playing') {
        setShowTransition(true);
        setCountdown(3);
      }
      prevStatusRef.current = gameState.status;
    }
  }, [gameState?.status]);


  useEffect(() => {
    let timer;
    if (showTransition && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (showTransition && countdown === 0) {
      setShowTransition(false);
    }
    return () => clearTimeout(timer);
  }, [showTransition, countdown]);

  
  //-----------------------handling movement logic---------------------------
  const handleMove = (direction) => {
    //send message only if its the players turn
    if (gameState.turn === myPlayerId) {
      socket.emit('move_player', { player: myPlayerId, direction: direction });
    }
  }

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

   //cleanup function
   return () => {
    socket.off('connect', handleConnect);
    socket.off('game_update', handleGameUpdate);
    };
  }, []); 

//-------------------------------------------------------------------------------------------------------

  //when a player is selected, ID gets locked and sent to backend to claim it.
  const handleChoosePlayer = (playerId) => {
    setMyPlayerId(playerId);
    socket.emit('claim_player', playerId);
  }; 

  const handleCancelWaiting = () => {
    if (myPlayerId) {
      socket.emit('unclaim_player', myPlayerId);
    }
    setMyPlayerId(null);
    setGameStarted(false);
  };

//-----------------------------handle reset server button------------------------------
  const handleResetServer = () => {
    //warning popup message
    if (window.confirm("Are you sure you want to start New Game?")) {
      socket.emit('reset_server');
    }
  };

// ===============================THE SPLASH SCREEN=================================================
  if (!gameStarted) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'fixed',
        inset: 0,
        height: '100vh',  // Fits the real device viewport, including mobile browser bars
        maxwidth: '100vw',
        overflow: 'hidden',
        
        // THE MAGIC FULLSCREEN SETTINGS:
        backgroundImage: 'url("/homepg.png")',
        backgroundSize: 'cover',       
        backgroundPosition: 'center',  
        backgroundRepeat: 'no-repeat',
        boxShadow: 'inset 0 0 50px rgba(30, 80, 0, 100)',
        
        margin: 0,
        padding: 0,
        gap: '20px',
        paddingTop: '60px'
      }}>
        
        <button
          onClick={() => setGameStarted(true)}
          style={{ 
            // Removed marginTop since it is now perfectly centered on the background
            padding: '8px 70px', 
            fontSize: '2.5rem', 
            cursor: 'pointer', 
            borderRadius: '12px', 
            border: 'none', 
            backgroundColor: '#ff9d00', 
            color: 'white', 
            fontWeight: 'bold',
            fontFamily: 'inherit',
            boxShadow: '0 18px 35px rgba(0, 0, 0, 0.85), inset 0 0 10px rgb(255, 255, 255)',
            transition: 'transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease',
            zIndex: 10 // Ensures the button stays clickable above the background
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-0px) scale(1)';
            e.target.style.boxShadow = ' inset 0 0 7px rgba(0, 0, 0, 100)';
            e.target.style.backgroundColor = '#f9a514';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0) scale(1)';
            e.target.style.boxShadow = '0 18px 35px rgba(0, 0, 0, 0.85), inset 0 0 10px rgb(255, 255, 255)';
            e.target.style.backgroundColor = '#f39c12';
          }}
          onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.target.style.transform = 'translateY(-6px) scale(1.06)'}
        >Play </button>

        <button
          onClick={handleResetServer}
          style={{ 
            padding: '8px 50px', 
            fontSize: '1.8rem', 
            cursor: 'pointer', 
            borderRadius: '10px', 
            border: 'none', 
            backgroundColor: '#cf2525', 
            color: 'white', 
            fontWeight: 'bold',
            fontFamily: 'inherit',
            boxShadow: '0 18px 35px rgba(0, 0, 0, 0.85), inset 0 0 10px rgb(255, 243, 243)',
            transition: 'transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-0.5px) scale(1)';
            e.target.style.boxShadow = ' inset 0 0 10px rgba(0, 0, 0, 50)';
            e.target.style.backgroundColor = '#dc1515';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0) scale(1)';
            e.target.style.boxShadow = '0 18px 35px rgba(0, 0, 0, 0.85), inset 0 0 10px rgb(255, 255, 255)';
            e.target.style.backgroundColor = '#e40404';
          }}
          onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.target.style.transform = 'translateY(-6px) scale(1.06)'}
        > New Game </button>
      </div>
    );
  }
  // ===============================================================================================

  if (!gameState)
    return <div className="lobby-container">
      <h2>Loading game...</h2></div>;
  
//-----------------------------handle the RPS choice ------------------------------
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
  };
 
// ===============================THE LOBBY SCREEN - CHOOSE YOUR PLAYER=================================================
  if (!myPlayerId) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'fixed',
        inset: 0,
        height: '100vh',
        width: '100vw',
        backgroundImage: 'url("/gamebg.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
        paddingTop: '8vh' // Pushes content slightly down
      }}>
        
        {/* --- BACK BUTTON --- */}
        <img 
          src="/backbtn.svg" 
          alt="Back to Splash" 
          onClick={() => setGameStarted(false)}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            width: '60px', 
            cursor: 'pointer',
            transition: 'transform 0.2s',
            filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.4))'
          }}
          onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        />
  
        {/* --- TITLE --- */}
        <h1 style={{
          color: 'white',
          fontSize: '4.5rem',
          fontFamily: 'cursive, sans-serif', 
          textShadow: '3px 3px 0px rgba(0,0,0,0.7), 0px 5px 15px rgba(0,0,0,0.5)',
          margin: '0 0 5vh 0',
          letterSpacing: '2px'
        }}>
          Choose Player
        </h1>
  
        {/* --- CHARACTER SELECTORS --- */}
        <div style={{ display: 'flex', gap: '8vw', alignItems: 'flex-end', justifyContent: 'center' }}>
          
          {/* BOB (Player 1) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', position: 'relative' }}>
            <img 
              src="/bob.svg" 
              alt="Bob" 
              style={{ 
                height: '45vh', 
                filter: gameState.p1_claimed ? 'grayscale(100%) brightness(50%)' : 'drop-shadow(0 15px 15px rgba(0,0,0,0.5))',
                transition: 'filter 0.3s, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                transformOrigin: 'bottom center',
                transform: hoveredPlayer === 'p1' ? 'scale(1.08) translateY(-15px)' : 'scale(1) translateY(0)'
              }} 
            />
            
            <button
              onClick={() => handleChoosePlayer('p1')}
              disabled={gameState.p1_claimed}
              style={{ 
                backgroundColor: gameState.p1_claimed ? '#7f8c8d' : '#ffa500', 
                color: 'white', 
                padding: '12px 60px', 
                fontSize: '2rem',
                fontWeight: 'bold',
                fontFamily: 'cursive, sans-serif',
                border: 'none', 
                borderRadius: '15px', 
                cursor: gameState.p1_claimed ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 0px rgba(200, 100, 0, 1), 0 15px 20px rgba(0,0,0,0.4)', 
                textShadow: '2px 2px 4px rgba(0,0,0,0.4)',
                transition: 'transform 0.1s, box-shadow 0.1s'
              }}
              onMouseEnter={() => {
                if(!gameState.p1_claimed) setHoveredPlayer('p1');
              }}
              onMouseLeave={() => {
                if(!gameState.p1_claimed) setHoveredPlayer(null);
              }}
              onMouseDown={(e) => { 
                if(!gameState.p1_claimed) {
                  e.target.style.boxShadow = '0 0px 0px rgba(200, 100, 0, 1), 0 5px 10px rgba(0,0,0,0.4)';
                }
              }}
              onMouseUp={(e) => { 
                if(!gameState.p1_claimed) {
                  e.target.style.transform = 'translateY(0px)';
                  e.target.style.boxShadow = '0 8px 0px rgba(200, 100, 0, 1), 0 15px 20px rgba(0,0,0,0.4)';
                }
              }}
            >
              {gameState.p1_claimed ? 'Taken' : 'Bob'}
            </button>
          </div>
  
          {/* BIN (Player 2) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', position: 'relative' }}>
            <img 
              src="/bin.svg" 
              alt="Bin" 
              style={{ 
                height: '45vh', 
                filter: gameState.p2_claimed ? 'grayscale(100%) brightness(50%)' : 'drop-shadow(0 15px 15px rgba(0,0,0,0.5))',
                transition: 'filter 0.3s, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                transformOrigin: 'bottom center',
                transform: hoveredPlayer === 'p2' ? 'scale(1.08) translateY(-15px)' : 'scale(1) translateY(0)'
              }} 
            />
            
            <button
              onClick={() => handleChoosePlayer('p2')}
              disabled={gameState.p2_claimed}
              style={{ 
                backgroundColor: gameState.p2_claimed ? '#7f8c8d' : '#00e640', 
                color: 'white', 
                padding: '12px 60px', 
                fontSize: '2rem',
                fontWeight: 'bold',
                fontFamily: 'cursive, sans-serif',
                border: 'none', 
                borderRadius: '15px', 
                cursor: gameState.p2_claimed ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 0px rgba(0, 150, 40, 1), 0 15px 20px rgba(0,0,0,0.4)', 
                textShadow: '2px 2px 4px rgba(0,0,0,0.4)',
                transition: 'transform 0.1s, box-shadow 0.1s'
              }}
              onMouseEnter={() => {
                if(!gameState.p2_claimed) setHoveredPlayer('p2');
              }}
              onMouseLeave={() => {
                if(!gameState.p2_claimed) setHoveredPlayer(null);
              }}
              onMouseDown={(e) => { 
                if(!gameState.p2_claimed) {
                  e.target.style.boxShadow = '0 0px 0px rgba(0, 150, 40, 1), 0 5px 10px rgba(0,0,0,0.4)';
                }
              }}
              onMouseUp={(e) => { 
                if(!gameState.p2_claimed) {
                  e.target.style.transform = 'translateY(0px)';
                  e.target.style.boxShadow = '0 8px 0px rgba(0, 150, 40, 1), 0 15px 20px rgba(0,0,0,0.4)';
                }
              }}
            >
              {gameState.p2_claimed ? 'Taken' : 'Bin'}
            </button>
          </div>
  
        </div>
      </div>
    );
  }

//=========================WAITING ROOM - WAIT FOR OTHER PLAYER TO JOIN===========================================
if (gameState.status === 'waiting_for_players') {
  return(
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.72)), url("/gamebg.png")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      gap: '28px'
    }}>
      <div style={{
        width: '360px',
        height: '138px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'url("/lobbywood.svg")',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'drop-shadow(0 12px 14px rgba(0,0,0,0.55))'
      }}>
        <h1 style={{
          margin: 0,
          color: 'white',
          fontSize: '2.3rem',
          fontFamily: 'cursive, sans-serif',
          fontWeight: 'bold',
          textShadow: '2px 3px 0 rgba(0,0,0,0.45)',
          letterSpacing: '1px'
        }}> LOBBY </h1>
      </div>

      <h2 style={{
        margin: 0,
        color: 'white',
        fontSize: '1.8rem',
        fontFamily: 'cursive, sans-serif',
        textShadow: '2px 3px 5px rgba(0,0,0,0.85)',
        animation: 'pulse 1.5s infinite'
      }}>  Waiting for {myPlayerId === 'p1' ? 'Bin' : 'Bob'} ... </h2>

      <button
        onClick={handleCancelWaiting}
        style={{
          width: '190px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          padding: 0,
          border: 'none',
          backgroundColor: 'transparent',
          backgroundImage: 'url("/yellowbtn.svg")',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          color: 'white',
          cursor: 'pointer',
          fontSize: '1.25rem',
          fontWeight: 'bold',
          fontFamily: 'cursive, sans-serif',
          textShadow: '2px 2px 3px rgba(0,0,0,0.45)',
          filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.5))',
          transition: 'transform 0.14s ease, filter 0.14s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-3px) scale(1.04)';
          e.target.style.filter = 'drop-shadow(0 14px 13px rgba(0,0,0,0.55))';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0) scale(1)';
          e.target.style.filter = 'drop-shadow(0 10px 10px rgba(0,0,0,0.5))';
        }}
        onMouseDown={(e) => {
          e.target.style.transform = 'translateY(2px) scale(0.97)';
        }}
        onMouseUp={(e) => {
          e.target.style.transform = 'translateY(-3px) scale(1.04)';
        }}
      > CANCEL </button>
    </div>
  );
}

//==============================THE RPS SCREEN - CHOOSE YOUR MOVE=================================================
  if (gameState.status === 'rps' || showTransition) {
    const myChoice = myPlayerId === 'p1' ? gameState.p1_rps : gameState.p2_rps;
    const opponentId = myPlayerId === 'p1' ? 'p2' : 'p1';
    const opponentName = opponentId === 'p1' ? 'Bob' : 'Bin';
    const opponentHasChosen = opponentId === 'p1' ? gameState.p1_rps : gameState.p2_rps;

    return(
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        position: 'fixed', inset: 0, height: '100vh', width: '100vw',
        backgroundImage: 'url("/gamebg.png")', backgroundSize: 'cover', backgroundPosition: 'center',
        overflow: 'hidden', paddingTop: '5vh'
      }}>
        
        {/* --- VS HEADER --- */}
        <div style={{ display: 'flex', width: '80%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8vh' }}>
          <div style={{ backgroundColor: '#ffa500', padding: '10px 60px', borderRadius: '15px', color: 'white', fontSize: '2rem', fontWeight: 'bold', border: '3px solid #cc8400', boxShadow: '0 8px 15px rgba(0,0,0,0.5)' }}>Bob</div>
          <div style={{ color: 'white', fontSize: '3rem', fontWeight: 'bold', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>VS</div>
          <div style={{ backgroundColor: '#00e640', padding: '10px 60px', borderRadius: '15px', color: 'white', fontSize: '2rem', fontWeight: 'bold', border: '3px solid #00b332', boxShadow: '0 8px 15px rgba(0,0,0,0.5)' }}>Bin</div>
        </div>

        <h2 style={{ color: 'white', fontSize: '2.5rem', textShadow: '2px 2px 5px rgba(0,0,0,0.8)', marginBottom: '5vh' }}>
          Mini-Game: Who gets to go First?
        </h2>
      
        {/* RPS SELECTION AREA */}
        {!myChoice ? (
          // BEFORE I HAVE CHOSEN
          <div style={{ display: 'flex', gap: '5vw', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/rock.svg" alt="Rock" onClick={() => handleRpsChoice('rock')} style={{ height: '25vh', cursor: 'pointer', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.4))', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.target.style.transform = 'scale(1.1) translateY(-10px)'} onMouseLeave={(e) => e.target.style.transform = 'scale(1) translateY(0)'} />
            <img src="/paper.svg" alt="Paper" onClick={() => handleRpsChoice('paper')} style={{ height: '25vh', cursor: 'pointer', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.4))', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.target.style.transform = 'scale(1.1) translateY(-10px)'} onMouseLeave={(e) => e.target.style.transform = 'scale(1) translateY(0)'} />
            <img src="/scissors.svg" alt="Scissors" onClick={() => handleRpsChoice('scissors')} style={{ height: '25vh', cursor: 'pointer', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.4))', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.target.style.transform = 'scale(1.1) translateY(-10px)'} onMouseLeave={(e) => e.target.style.transform = 'scale(1) translateY(0)'} />
          </div>
        ) : (
          // AFTER I HAVE CHOSEN
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '5vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10vw' }}>
              
              {/* My Locked Choice */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h3 style={{ color: 'white', marginBottom: '20px' }}>Your Choice</h3>
                <img src={`/${myChoice}.svg`} alt={myChoice} style={{ height: '25vh', filter: 'drop-shadow(0 15px 15px rgba(0,0,0,0.6))', transform: 'scale(1.1)' }} />
              </div>

              {/* Opponent's Choice */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h3 style={{ color: 'white', marginBottom: '20px' }}>{opponentName}'s Choice</h3>
                {opponentHasChosen ? (
                   showTransition ? (
                      <img src={`/${opponentHasChosen}.svg`} alt={opponentHasChosen} style={{ height: '25vh', filter: 'drop-shadow(0 15px 15px rgba(0,0,0,0.6))', transform: 'scale(1.1)' }} />
                   ) : (
                      // Waiting for backend to resolve tie/win (Hidden lock)
                      <div style={{ height: '25vh', width: '25vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '20px' }}><span style={{ fontSize: '4rem' }}>🔒</span></div>
                   )
                ) : (
                   // Still waiting for them to pick
                   <div style={{ height: '25vh', width: '25vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '20px', border: '3px dashed rgba(255,255,255,0.5)' }}>
                     <span style={{ color: 'white', fontSize: '2rem', animation: 'pulse 1.5s infinite' }}>...</span>
                   </div>
                )}
              </div>
            </div>
            
            {/* Hide "Waiting..." text if the transition is running */}
            {!showTransition && (
              <h3 style={{ color: '#f39c12', fontSize: '2rem', marginTop: '6vh', textShadow: '2px 2px 4px rgba(0,0,0,0.8)', animation: 'pulse 1.5s infinite' }}>
                Waiting for {opponentName} selection...
              </h3>
            )}
          </div>
        )}

        {/* ======================= TRANSITION WINNER OVERLAY ======================= */}
        {showTransition && (
          <div style={{
            position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100
          }}>
            
            {/* WOODEN BOARD */}
            <div style={{
              width: '500px', height: '160px', backgroundImage: 'url("/lobbywood.svg")', backgroundSize: '100% 100%',
              backgroundPosition: 'center', backgroundRepeat: 'no-repeat', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', filter: 'drop-shadow(0 15px 15px rgba(0,0,0,0.6))',
              marginBottom: '40px', paddingBottom: '10px'
            }}>
              <h1 style={{ color: 'white', fontSize: '3.5rem', margin: '0 0 5px 0', fontFamily: 'cursive, sans-serif', textShadow: '2px 3px 0 rgba(0,0,0,0.5)' }}>
                {gameState.turn === 'p1' ? 'Bob' : 'Bin'} WINS!!
              </h1>
              <h3 style={{ color: 'white', fontSize: '1.5rem', margin: 0, fontFamily: 'cursive, sans-serif', textShadow: '1px 2px 0 rgba(0,0,0,0.5)' }}>
                Gets to make a move first
              </h3>
            </div>

            {/* POWERUP REWARD */}
            {gameState[`${gameState.turn}_inventory`]?.length > 0 && (
              <img 
                src={gameState[`${gameState.turn}_inventory`][0] === 'bomb' ? '/bomb.svg' : '/boots.svg'} 
                alt="Powerup Reward"
                style={{ height: '150px', animation: 'pulse 1.5s infinite', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.6))' }}
              />
            )}

            {/* COUNTDOWN */}
            <h2 style={{ color: 'white', fontSize: '1.8rem', marginTop: '60px', fontFamily: 'cursive, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              Entering game in {countdown}...
            </h2>

          </div>
        )}
      </div>
    );
  }

// ===============================THE GAME BOARD SCREEN===============================================
const getIconSrc = (item) => {
  if (item === "wall") return "/wall.svg";
  if (item === "medkit") return "/medkit.svg";
  if (item === "bomb") return "/bomb.svg";
  if (item === "boots") return "/boots.svg";
  return null;
};

const renderGameIcon = (item, size = 30) => {
  const src = getIconSrc(item);

  if (!src) return item;

  return (
    <img
      src={src}
      alt={item}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'block',
        filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))'
      }}
    />
  );
};

 const cells =[];
 // this will loop 121 times to create the grid cells.
  for (let i = 0; i < totalcells; i++) {
    const x = i % gridSize;
    const y = Math.floor(i / gridSize);

    let cellClass = "grid-cell"; //default class for all cells
    let cellContent = ""; //default content for all cells
  

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
      cellContent = "P1";
    } else if (gameState.p2.x === x && gameState.p2.y === y) {
      cellClass = "grid-cell cell-p2"; 
      cellContent = "P2";
    } else if (isP1Base) {
      //player 1 base
      cellClass = "grid-cell cell-base-p1";
      cellContent = "🚩";
    } else if (isP2Base) {
      //player 2 base
      cellClass = "grid-cell cell-base-p2";
      cellContent = "🚩";
    } else if (isWall) {
      //wall
      cellClass = "grid-cell cell-wall";
      cellContent = renderGameIcon("wall", 32);
    } else if (isMedkit) {
      //medkit
      cellClass = "grid-cell cell-medkit";
      cellContent = renderGameIcon("medkit", 30);
    }
    else {
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
        {cellContent}
      </div>  
    );
}

const canMove = gameState.turn === myPlayerId;
const moveButtonStyle = (rotation, extraStyles = {}) => ({
  width: 'clamp(45px, 7vw, 100px)',   // Adjusted minimum size so it doesn't get too tiny
  height: 'clamp(45px, 7vw, 100px)',
  padding: 0,
  border: 'none',
  backgroundColor: 'transparent',
  backgroundImage: 'url("/movebtn.svg")',
  backgroundSize: '100% 100%',        // Fixed sizing
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  cursor: canMove ? 'pointer' : 'not-allowed',
  filter: canMove ? 'drop-shadow(0 8px 8px rgba(0,0,0,0.45))' : 'grayscale(100%) brightness(55%)',
  transform: `rotate(${rotation}deg)`, // Only ONE transform needed
  transition: 'filter 0.12s ease, transform 0.12s ease',
  ...extraStyles
});

const auditLogBoxStyle = {
  width: '100%',
  height: '80%',
  backgroundColor: 'transparent',
  backgroundImage: 'url("/logbox.svg")',
  backgroundSize: '90% 80%',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: 'clamp(10px, 3vh, 98px) clamp(24px, 3vw, 42px) clamp(30px, 4vh, 46px)',
  filter: 'drop-shadow(0 12px 16px rgba(76, 41, 7, 0.84))',
  boxSizing: 'border-box',
};

const auditLogHeaderStyle = {
  color: '#310404',
  padding: 'clamp(20px, 2vh, 70px) clamp(20px, 8vw, 100px)',
  fontSize: 'clamp(10px, 1vw, 15px)',
  fontFamily: 'cursive, sans-serif',
  letterSpacing: '1px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  textShadow: '1px 2px 2px rgba(0,0,0,0.65)'
};

const auditLogContentStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: 'clamp(10px, 1vh, 100px) clamp(10px, 8vw, 130px)',
  fontSize: 'clamp(11px, 1.0vw, 18px)',
  fontWeight: 'bold',
  fontFamily: 'sans-serif',
  letterSpacing: '1px',
  color: 'white',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  lineHeight: 1.25,
  minWidth: 0
};

const auditLogEntryStyle = {
  borderLeft: '4px solid #1a0b01',
  paddingLeft: '8px',
  paddingRight: '2px',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  maxWidth: '100%',
  boxSizing: 'border-box'
};

const powerupDrawerStyle = {
  width: 'clamp(10px, 40vw, 250px)',
  height: 'clamp(10px, 50vh, 300px)',
  backgroundColor: 'transparent',
  backgroundImage: 'url("/logbox.svg")',
  backgroundSize: '100% 100%',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  padding: 'clamp(32px, 5vh, 44px) clamp(18px, 2vw, 28px) clamp(22px, 4vh, 30px)',
  boxSizing: 'border-box',
  filter: 'drop-shadow(0 10px 12px rgba(76, 41, 7, 0.65))'
};

const powerupDrawerTitleStyle = {
  color: '#310404',
  textAlign: 'center',
  margin: '0 0 clamp(16px, 4vh, 100px)',
  fontSize: 'clamp(0rem, 1vw, 5rem)',
  fontFamily: 'cursive, sans-serif',
  fontWeight: 'bold',
  textShadow: '1px 1px 1px rgba(255,255,255,0.35)'
};

const renderHpBar = (playerName, hp, barSrc) => (
  <div style={{
    width: 'clamp(250px, 30vw, 450px)',
    height: 'clamp(98px, 13vw, 175px)',
    padding: 'clamp(20px, 4vw, 80px) clamp(10px, 2vw, 10px) 0 clamp(2px, 1vw, 10px)',
    backgroundImage: `url("${barSrc}")`,
    backgroundSize: '80% 80%',
    backgroundRepeat: 'no-repeat',
    filter: 'drop-shadow(0 7px 8px rgba(0,0,0,0.35))',
    position: 'relative',
    fontFamily: 'cursive, sans-serif',

  }}>
    <span style={{
      position: 'absolute',
      top: 'clamp(-4px, 3.5vw, 100px)',
      Bottom: 'clamp(20px, 6vw, 192px)',
      left: 'clamp(22px, 3vw, 72px)',
      color: '#000000',
      fontSize: 'clamp(18px, 2vw, 74px)',
      fontWeight: 'bold',
      textShadow: '1px 1px 0 rgba(255,255,255,0.4)'
    }}>
      {playerName}
    </span>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'clamp(7px, 2vw, 16px)',
      marginTop: 'clamp(-5px, -2vh, 100px)'


    }}>
      {Array.from({ length: 3 }).map((_, index) => (
        <img
          key={index}
          src="/heart.svg"
          alt="HP"
          style={{
            width: 'clamp(20px, 3.5vw, 80px)' ,
            height: 'clamp(20px, 3.5vw, 80px)',
            objectFit: 'contain',
            opacity: index < hp ? 1 : 0.22,
            filter: index < hp ? 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))' : 'grayscale(100%)'
          }}
        />
      ))}

    </div>
  </div>
);

 return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100dvh',
      backgroundImage: 'url("/gamebg.png")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif'
    }}>

      {/* ------------------------ TOP HUD AREA ------------------------- */}
      <div style={{
        position: 'absolute',
        top: '3vh',
        left: '4vw',
        right: '0vw',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        zIndex: 10
      }}>
        
        {/* Left Side: Bob's HP Bar (Scaled down to fit) */}
        <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
          {renderHpBar('Bob', gameState.p1.hp, '/hpbaryellow.svg')}
        </div>

      {/* Center: Turn Counter / Timer */}
        <div style={{
          position: 'absolute',     
          left: '50%',              
          transform: 'translateX(-50%)', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily: 'cursive, sans-serif',
       }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: 'clamp(1rem, 1.5vw, 2rem)', textShadow: '1px 1px 3px black', letterSpacing: '2px', marginBottom: '5px' }}>
            TURNS
          </span>
          <div style={{
            width: 'clamp(150px, 16vw, 300px)',
            height: 'clamp(50px, 6vw, 90px)',
            backgroundImage: 'url("/lobbywood.svg")',
            backgroundSize: '100% 100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 'clamp(1.2rem, 1.5vw, 2rem)',
            fontWeight: 'bold',
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))'
          }}>
            {gameState.p1_moves_remaining} : {gameState.p2_moves_remaining}
          </div>
        </div>

        {/* Right Side: Bin's HP Bar (Scaled down to fit) */}
        <div style={{ transform: 'scale(0.8)', transformOrigin: 'top right' }}>
          {renderHpBar('Bin', gameState.p2.hp, '/hpbargreen.svg')}
        </div>
      </div>

      {/* ------------------------ MAIN GAME AREA ------------------------- */}
      <div style={{
        position: 'absolute',
        top: '18vh', 
        bottom: '10vh',
        left: '3vw',
        right: '2.5vw',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>

        {/* ================================================== LEFT COLUMN =============================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '80%' }}>
          
          {/* Active Player's Drawer */}
          <div style={{ ...powerupDrawerStyle, position: 'relative', top: 'clamp(0px, 10vh, 20px)', left: 'auto', margin: 25 }}>
            <h3 style={powerupDrawerTitleStyle}>Your Drawer</h3>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              {/* Dynamically loads whichever inventory belongs to the device player */}
              {gameState[`${myPlayerId}_inventory`]?.map((item, index) => (
                <li 
                  key={index} 
                  onClick={() => handleUsePowerup(item)}
                  style={{ cursor: gameState.turn === myPlayerId ? 'pointer' : 'not-allowed' }}
                >
                  {renderGameIcon(item, 50)}
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom Left Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', marginBottom: '5px' }}>
            
            {/* Reset / Undo Button */}
            <button 
              onClick={handleResetServer} 
              aria-label="Reset game"
              style={{ width: 'clamp(10px,7vw, 70px)', height: 'clamp(46px, 5vw, 70px)', backgroundColor: 'transparent', backgroundImage: 'url("/restartbtn.svg")', backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', border: 'none', cursor: 'pointer', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
            />
            
            {/* Home / Splash Screen Button */}
            <button 
              onClick={() => setGameStarted(false)} 
              aria-label="Home"
              style={{ width: 'clamp(46px, 5vw, 70px)', height: 'clamp(46px, 5vw, 70px)', backgroundColor: 'transparent', backgroundImage: 'url("/homebtn.svg")', backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', border: 'none', cursor: 'pointer', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}
            />
          </div>
        </div>


        {/* ==================================================== CENTER COLUMN (BOARD) ========================================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          
          {/* Game Over Popup Overlay */}
          {gameState.status === 'game_over' && (
            <div style={{ position: 'absolute', zIndex: 50, top: '20%', backgroundColor: 'rgba(0,0,0,0.85)', padding: '30px', borderRadius: '15px', textAlign: 'center', filter: 'drop-shadow(0 10px 20px black)', border: '2px solid #ff4d4d' }}>
              <h2 style={{ color: '#ff4d4d', margin: '0 0 20px 0', fontSize: '2.5rem' }}>
                🚨 GAME OVER! {gameState.winner === 'p1' ? 'Bob' : 'Bin'} Wins! 🚨
              </h2>
              {rematchRequested === myPlayerId ? (
                  <div style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '1.2rem' }}>Waiting for opponent... ⏳</div>
              ) : rematchRequested !== null ? (
                  <button onClick={handlePlayAgain} style={{ padding: '10px 25px', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '8px', border: 'none', backgroundColor: '#2ecc71', color: 'white', fontWeight: 'bold' }}>✅ Accept Rematch</button>
              ) : (
                  <button onClick={handlePlayAgain} style={{ padding: '10px 25px', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '8px', border: 'none', backgroundColor: '#c0392b', color: 'white', fontWeight: 'bold' }}>🔄 Play Again</button>
              )}
            </div>
          )}

          <div className={`board ${myPlayerId === 'p2' ? 'board-rotated' : ''}`} style={{
            filter: 'drop-shadow(0 25px 30px rgba(0,0,0,0.8))',
          }}>
            {cells}
          </div>
        </div>

        {/* ========================================================== RIGHT COLUMN ===================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', height: '100%' }}>
          
          {/* Audit Log Box */}
          <div style={{ ...auditLogBoxStyle, position: 'relative', top: '11px', right: '30px', margin: 'auto' }}>
              <div style={auditLogHeaderStyle}>
                  <div style={{ width: '8px', height: 'px', borderRadius: '50%', backgroundColor: '#1e1500' }}></div>
                  LIVE AUDIT LOG
              </div>
              <div className="audit-log-scroll" style={auditLogContentStyle}>
                  {auditLogs.length === 0 ? (
                      <div style={{ color: '#1e1500', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>Waiting for events...</div>
                  ) : (
                      auditLogs.map((log, index) => (
                          <div key={index} style={auditLogEntryStyle}>
                              <span style={{ color: '#fa9d9d', fontWeight: 'bold' }}>[{log.player.toUpperCase()}]</span> 
                              <span style={{ color: '#00d218', marginLeft: '6px' }}>{log.action}</span>
                              <div style={{ color: '#1e1500', marginTop: '1px' }}>{log.details}</div>
                          </div>
                      ))
                  )}
                  <div ref={logsEndRef} />
              </div>
          </div>

          {/* D-PAD CONTROLS */}
          <div style={{ display: 'flex', flexDirection: 'column', left: 'auto' , alignItems: 'center', marginBottom: '10px', marginLeft: '-10px' }}>
            {/* Up */}
            <button onClick={() => handleMove('forward')} disabled={!canMove} style={moveButtonStyle(90)} />
            
            <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
              {/* Left */}
              <button onClick={() => handleMove('left')} disabled={!canMove} style={moveButtonStyle(0)} />
              
              {/* Down */}
              <button onClick={() => handleMove('backward')} disabled={!canMove} style={moveButtonStyle(270)} />
              
              {/* Right */}
              <button onClick={() => handleMove('right')} disabled={!canMove} style={moveButtonStyle(180)} />
            </div>
          </div>

        </div>

      </div>
    </div> 
  );
}


export default App;
