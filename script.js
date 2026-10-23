const socket = io();
const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const turnIndicator = document.getElementById('turn-indicator');

let myRole = null; // 'red', 'blue', ya 'spectator'

// Server se role milna
socket.on('assigned-role', (role) => {
    myRole = role;
    updateStatus();
    console.log("Mera role hai:", myRole);
});

const boardPoints = [
    { x: 50, y: 50 }, { x: 250, y: 50 }, { x: 450, y: 50 },
    { x: 450, y: 250 }, { x: 450, y: 450 }, { x: 250, y: 450 },
    { x: 50, y: 450 }, { x: 50, y: 250 },
    { x: 110, y: 110 }, { x: 250, y: 110 }, { x: 390, y: 110 },
    { x: 390, y: 250 }, { x: 390, y: 390 }, { x: 250, y: 390 },
    { x: 110, y: 390 }, { x: 110, y: 250 },
    { x: 170, y: 170 }, { x: 250, y: 170 }, { x: 330, y: 170 },
    { x: 330, y: 250 }, { x: 330, y: 330 }, { x: 250, y: 330 },
    { x: 170, y: 330 }, { x: 170, y: 250 }
];

const connections = {
    0: [1, 7], 1: [0, 2, 9], 2: [1, 3], 3: [2, 4, 11],
    4: [3, 5], 5: [4, 6, 13], 6: [5, 7], 7: [0, 6, 15],
    8: [9, 15], 9: [1, 8, 10, 17], 10: [9, 11], 11: [3, 10, 12, 19],
    12: [11, 13], 13: [5, 12, 14, 21], 14: [13, 15], 15: [7, 8, 14, 23],
    16: [17, 23], 17: [9, 16, 18], 18: [17, 19], 19: [11, 18, 20],
    20: [19, 21], 21: [13, 20, 22], 22: [21, 23], 23: [15, 16, 22]
};

const mills = [
    [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0],
    [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8],
    [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16],
    [1, 9, 17], [3, 11, 19], [5, 13, 21], [7, 15, 23]
];

let piecesState = Array(24).fill(null);
let currentPlayer = 'red';
let redUnplaced = 9;
let blueUnplaced = 9;
let selectedPieceIndex = null;
let isCapturePhase = false;

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#5c3a21';
    ctx.lineWidth = 4;

    ctx.strokeRect(50, 50, 400, 400);
    ctx.strokeRect(110, 110, 280, 280);
    ctx.strokeRect(170, 170, 160, 160);

    ctx.beginPath();
    ctx.moveTo(250, 50); ctx.lineTo(250, 170);
    ctx.moveTo(450, 250); ctx.lineTo(330, 250);
    ctx.moveTo(250, 450); ctx.lineTo(250, 330);
    ctx.moveTo(50, 250); ctx.lineTo(170, 250);
    ctx.stroke();

    boardPoints.forEach((p, index) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        
        if (piecesState[index] === 'red') {
            ctx.fillStyle = '#e64553';
            ctx.fill();
        } else if (piecesState[index] === 'blue') {
            ctx.fillStyle = '#1e66f5';
            ctx.fill();
        } else {
            ctx.fillStyle = '#311b0e';
            ctx.fill();
        }

        if (selectedPieceIndex === index) {
            ctx.strokeStyle = '#f5c211';
            ctx.lineWidth = 4;
            ctx.stroke();
        } else if (piecesState[index] !== null) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

function countPieces(player) {
    return piecesState.filter(p => p === player).length;
}

function checkMillCreated(pointIndex, player) {
    return mills.some(mill => {
        if (mill.includes(pointIndex)) {
            return mill.every(idx => piecesState[idx] === player);
        }
        return false;
    });
}

function isPartOfMill(pointIndex, player) {
    return mills.some(mill => {
        if (mill.includes(pointIndex)) {
            return mill.every(idx => piecesState[idx] === player);
        }
        return false;
    });
}

function sendMoveToServer() {
    socket.emit('player-move', {
        piecesState,
        currentPlayer,
        redUnplaced,
        blueUnplaced,
        isCapturePhase
    });
}

canvas.addEventListener('click', (event) => {
    // Agar player spectator hai ya uski baari nahi hai, toh click kaam nahi karega
    if (myRole === 'spectator') {
        alert("Aap sirf game dekh sakte hain (Spectator mode).");
        return;
    }
    if (myRole !== currentPlayer) {
        alert("Yeh aapki baari nahi hai!");
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    boardPoints.forEach((p, index) => {
        const distance = Math.hypot(p.x - x, p.y - y);
        if (distance < 20) {
            
            if (isCapturePhase) {
                const opponent = currentPlayer === 'red' ? 'blue' : 'red';
                if (piecesState[index] === opponent) {
                    const inMill = isPartOfMill(index, opponent);
                    const opponentIndices = [];
                    piecesState.forEach((piece, idx) => {
                        if (piece === opponent) opponentIndices.push(idx);
                    });
                    const allInMills = opponentIndices.every(idx => isPartOfMill(idx, opponent));

                    if (inMill && !allInMills) {
                        alert("Yeh goti Mill ke andar hai! Pehle doosri khuli gotiyan marein.");
                        return;
                    }

                    piecesState[index] = null;
                    isCapturePhase = false;

                    if (redUnplaced === 0 && blueUnplaced === 0 && countPieces(opponent) < 3) {
                        alert(` 🎉 ${currentPlayer.toUpperCase()} JEET GAYA!`);
                        resetGame();
                        sendMoveToServer();
                        return;
                    }

                    switchTurn();
                }
                updateStatus();
                drawBoard();
                sendMoveToServer();
                return;
            }

            if (redUnplaced > 0 || blueUnplaced > 0) {
                if (piecesState[index] === null) {
                    if (currentPlayer === 'red' && redUnplaced > 0) {
                        piecesState[index] = 'red';
                        redUnplaced--;
                        if (checkMillCreated(index, 'red')) {
                            isCapturePhase = true;
                        } else {
                            switchTurn();
                        }
                    } else if (currentPlayer === 'blue' && blueUnplaced > 0) {
                        piecesState[index] = 'blue';
                        blueUnplaced--;
                        if (checkMillCreated(index, 'blue')) {
                            isCapturePhase = true;
                        } else {
                            switchTurn();
                        }
                    }
                }
            } else {
                const totalPieces = countPieces(currentPlayer);
                const canFly = totalPieces === 3;

                if (selectedPieceIndex === null) {
                    if (piecesState[index] === currentPlayer) {
                        selectedPieceIndex = index;
                    }
                } else {
                    const isAdjacent = connections[selectedPieceIndex].includes(index);
                    
                    if (piecesState[index] === null && (isAdjacent || canFly)) {
                        piecesState[index] = currentPlayer;
                        piecesState[selectedPieceIndex] = null;
                        
                        if (checkMillCreated(index, currentPlayer)) {
                            isCapturePhase = true;
                        } else {
                            switchTurn();
                        }
                        selectedPieceIndex = null;
                    } else {
                        selectedPieceIndex = null;
                    }
                }
            }
            
            updateStatus();
            drawBoard();
            sendMoveToServer();
        }
    });
});

socket.on('board-update', (data) => {
    piecesState = data.piecesState;
    currentPlayer = data.currentPlayer;
    redUnplaced = data.redUnplaced;
    blueUnplaced = data.blueUnplaced;
    isCapturePhase = data.isCapturePhase;
    selectedPieceIndex = null;
    updateStatus();
    drawBoard();
});

function switchTurn() {
    currentPlayer = currentPlayer === 'red' ? 'blue' : 'red';
}

function updateStatus() {
    let roleText = myRole ? ` (Aapka Role: ${myRole.toUpperCase()})` : '';
    
    if (isCapturePhase) {
        turnIndicator.innerText = `🔥 MILL BANGA! ${currentPlayer.toUpperCase()} Goti Uthayein!${roleText}`;
        turnIndicator.style.color = '#f5c211';
        return;
    }

    if (redUnplaced > 0 || blueUnplaced > 0) {
        turnIndicator.innerText = `Turn: ${currentPlayer.toUpperCase()} | Unplaced: ${currentPlayer === 'red' ? redUnplaced : blueUnplaced}${roleText}`;
        turnIndicator.style.color = currentPlayer === 'red' ? '#e64553' : '#1e66f5';
    } else {
        const pieces = countPieces(currentPlayer);
        if (pieces === 3) {
            turnIndicator.innerText = `${currentPlayer.toUpperCase()} Flying Mode!${roleText}`;
            turnIndicator.style.color = '#f5c211';
        } else {
            turnIndicator.innerText = `Move Phase: ${currentPlayer.toUpperCase()} ki baari.${roleText}`;
            turnIndicator.style.color = currentPlayer === 'red' ? '#e64553' : '#1e66f5';
        }
    }
}

function resetGame() {
    piecesState = Array(24).fill(null);
    currentPlayer = 'red';
    redUnplaced = 9;
    blueUnplaced = 9;
    selectedPieceIndex = null;
    isCapturePhase = false;
    updateStatus();
    drawBoard();
}

updateStatus();
drawBoard();
   