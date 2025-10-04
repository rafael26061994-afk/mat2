// --- VARIÁVEIS DE ESTADO GLOBAL E CACHE DE ELEMENTOS ---
const screens = document.querySelectorAll('.screen');
const questionText = document.getElementById('question-text');
const answerOptions = document.querySelectorAll('.answer-option');
const timeBar = document.getElementById('time-bar');
const playerScoreElement = document.getElementById('player-score');
const playerXPElement = document.getElementById('player-xp'); 
const gameHeader = document.querySelector('#game-screen .game-header');
const alertSound = document.getElementById('alert-sound'); 
const librasAlert = document.getElementById('libras-alert'); 
const confettiContainer = document.getElementById('confetti-container'); 
const questionCounter = document.getElementById('question-counter'); 
const feedbackMessageElement = document.getElementById('feedback-message'); 

// Cache de botões de menu/voltar
const btnVoltar = document.querySelectorAll('.btn-voltar');
const btnVoltarHome = document.querySelectorAll('.btn-voltar-home');
const btnQuitGame = document.querySelector('.btn-quit-game');
const operationButtons = document.querySelectorAll('.operation-card');
const levelButtons = document.querySelectorAll('.level-btn');
const btnTreinarErros = document.getElementById('btn-treinar-erros');

// NOVO: Cache dos botões de ação
const btnExtendTime = document.getElementById('btn-extend-time');
const btnShowAnswer = document.getElementById('btn-show-answer');

// CUSTOS E GANHOS DE XP
const XP_COST_EXTEND_NORMAL = 100;
const XP_COST_EXTEND_ACCESS = 150; 
const XP_COST_HINT = 250;
const XP_GAIN_PER_HIT = 50; 

// TEMPOS
const TIME_EXTEND_NORMAL = 5; // Segundos adicionais no modo rápido (5s)
const TIME_EXTEND_ACCESS = 10; // Segundos adicionais no modo acessibilidade (10s)

let timerInterval;
let tempoMaximo = 15; 
const HIGH_SCORE_KEY = 'matemagica_high_scores';
const ERROR_STORAGE_KEY = 'matemagica_erros';
const PLAYER_XP_KEY = 'matemagica_player_xp'; 

let playerXP = 0; 

let gameState = {
    currentScreen: 'home-screen',
    currentOperation: null,
    currentLevel: null,
    isRapidMode: true,
    isAcessibilityActive: false,
    isVoiceReadActive: false,
    currentCorrectAnswer: null, 
    questionList: [], 
    currentQuestionIndex: 0, 
    consecutiveErrors: 0, 
    xpGainedThisRound: 0, 
};

let rodadaStats = {
    acertos: 0,
    erros: 0,
    pontuacao: 0,
    acertosSeguidos: 0,
    acertosSeguidosMax: 0,
    errosSalvosRodada: [], 
};

let highScores = {}; 
let errosPersistidos = []; 
let isTrainingMode = false; 

// Configuração da API de Leitura de Voz (Web Speech API)
const synth = window.speechSynthesis;

// --- ACESSIBILIDADE E PERSISTÊNCIA ---

/**
 * Leitura de voz da questão.
 * @param {string} textoQuestao - A questão a ser lida.
 */
function lerEmVoz(textoQuestao) {
    if (gameState.isVoiceReadActive && synth) {
        synth.cancel(); // Para qualquer fala anterior
        const utterance = new SpeechSynthesisUtterance(textoQuestao);
        
        // Configurações para melhor legibilidade (opcional)
        utterance.lang = 'pt-BR';
        utterance.rate = 1; // Velocidade normal
        utterance.pitch = 1.1; // Tom um pouco mais alto

        synth.speak(utterance);
    }
}

// NOVO: Funções de Persistência de XP
function carregarXP() {
    try {
        const xp = localStorage.getItem(PLAYER_XP_KEY);
        playerXP = xp ? parseInt(xp) : 0;
    } catch (e) {
        playerXP = 0;
    }
    updateXPDisplay();
}

function salvarXP() {
    try {
        localStorage.setItem(PLAYER_XP_KEY, playerXP.toString());
    } catch (e) {
        // Ignora falhas silenciosamente
    }
}

function updateXPDisplay() {
    if (playerXPElement) {
        playerXPElement.textContent = `XP: ${playerXP}`;
    }
    // Atualiza o custo no botão de tempo para o modo atual e o estado
    updateActionButtonsState(); 
}

function ganharXP(valor) {
    playerXP += valor;
    gameState.xpGainedThisRound += valor;
    salvarXP();
    updateXPDisplay();
}

function gastarXP(custo) {
    if (playerXP >= custo) {
        playerXP -= custo;
        salvarXP();
        updateXPDisplay();
        return true; 
    }
    return false;
}

// Persistência de Erros e Scores
function carregarErros() {
    try {
        const errosJSON = localStorage.getItem(ERROR_STORAGE_KEY);
        errosPersistidos = errosJSON ? JSON.parse(errosJSON) : [];
    } catch (e) {
        errosPersistidos = [];
    }
}

function salvarErros() {
    try {
        localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(errosPersistidos));
    } catch (e) {
        // Ignora falhas silenciosamente
    }
}

function registrarErro(questao, respostaCorreta, respostaUsuario) {
    errosPersistidos.push({
        questao: questao,
        respostaCorreta: respostaCorreta,
        respostaUsuario: respostaUsuario,
        timestamp: new Date().toISOString()
    });
    salvarErros();
}

function carregarHighScores() {
    try {
        const scoresJSON = localStorage.getItem(HIGH_SCORE_KEY);
        highScores = scoresJSON ? JSON.parse(scoresJSON) : {};
    } catch (e) {
        highScores = {};
    }
}

function salvarHighScores() {
    try {
        localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(highScores));
    } catch (e) {
        // Ignora falhas silenciosamente
    }
}

// Inicializa o carregamento dos dados
carregarErros(); 
carregarHighScores(); 
carregarXP(); 

// --- CONTROLE DE TELAS E CRONÔMETRO ---
function exibirTela(targetId) {
    if (synth) synth.cancel(); 
    // Garante que todas as telas percam o estado ativo
    screens.forEach(screen => screen.classList.remove('active'));
    // Ativa a tela alvo
    document.getElementById(targetId).classList.add('active');
    gameState.currentScreen = targetId;

    // Ações específicas ao mudar de tela
    if (targetId === 'ranking-screen') {
        renderRankingList();
    } else if (targetId === 'error-training-screen') {
        renderErrorTrainingList();
    }
}

function tocarAlerta() {
    if (alertSound) {
        alertSound.currentTime = 0;
        alertSound.play().catch(() => { /* Evita erro de user interaction */ });
    }
}

function iniciarCronometro() {
    librasAlert.classList.add('hidden');
    
    // CORREÇÃO: Se não for Modo Rápido (for Modo Estudo ou Treino), não inicia o timer.
    if (!gameState.isRapidMode || isTrainingMode) {
        clearInterval(timerInterval); 
        timeBar.style.width = '100%';
        timeBar.style.backgroundColor = 'var(--cor-sucesso)'; // Cor de 'tempo infinito'
        return; 
    }
    
    clearInterval(timerInterval); 
    
    // O cronômetro agora usa o tempo restante com base na barra visual (width)
    const tempoLimite = getCurrentTimeLimit(); 
    let tempoRestante = (parseFloat(timeBar.style.width) / 100) * tempoLimite;
    
    if (isNaN(tempoRestante) || tempoRestante <= 0.1) { // Garante reinício se for o primeiro
        tempoRestante = tempoLimite;
    }

    const alertaVozLibras = 10; 
    const alertaNormal = 5;      

    timeBar.style.width = `${(tempoRestante / tempoLimite) * 100}%`;
    timeBar.style.backgroundColor = 'var(--cor-sucesso)';
    
    timerInterval = setInterval(() => {
        tempoRestante -= 0.1;
        
        if (tempoRestante <= 0) {
            clearInterval(timerInterval);
            tempoRestante = 0;
            darFeedback(false, null); // Erro por tempo esgotado
            return;
        }

        const percentual = (tempoRestante / tempoLimite) * 100;
        timeBar.style.width = `${percentual}%`;

        // Alertas de tempo
        if (tempoRestante <= alertaNormal && tempoRestante > alertaNormal - 0.2) {
            tocarAlerta();
        }
        if (gameState.isAcessibilityActive && tempoRestante <= alertaVozLibras && tempoRestante > alertaVozLibras - 0.2) {
            tocarAlerta();
            librasAlert.classList.remove('hidden');
        }

        // Feedback Visual de Cores
        if (percentual <= 20) {
            timeBar.style.backgroundColor = 'var(--cor-erro)';
        } else if (percentual <= 50) {
            timeBar.style.backgroundColor = 'var(--cor-secundaria)';
        } else {
            timeBar.style.backgroundColor = 'var(--cor-sucesso)';
        }
    }, 100); 
}

/**
 * Função utilitária para pegar o tempo limite atual, considerando acessibilidade.
 */
function getCurrentTimeLimit() {
    // Verifica se VLibras está ativo (classe 'vw-started' é adicionada ao plugin)
    const vlibrasIsActive = document.querySelector('.vw-status-bar.vw-started');
    // Considera acessibilidade ativa se VLibras ou Leitura de Voz estiverem ON
    gameState.isAcessibilityActive = !!vlibrasIsActive || gameState.isVoiceReadActive;
    return gameState.isAcessibilityActive ? tempoMaximo * 2 : tempoMaximo;
}

// Função para Estender o Tempo
function estenderTempo() {
    if (!gameState.isRapidMode || isTrainingMode) {
        showFeedbackMessage('Ação indisponível no modo Estudo ou Treino.', 'warning', 3000);
        return;
    }
    
    const isAccess = gameState.isAcessibilityActive;
    const custo = isAccess ? XP_COST_EXTEND_ACCESS : XP_COST_EXTEND_NORMAL;
    const tempoExtra = isAccess ? TIME_EXTEND_ACCESS : TIME_EXTEND_NORMAL;

    if (!gastarXP(custo)) {
        showFeedbackMessage(`Você precisa de ${custo} XP para prorrogar!`, 'warning', 3000);
        return;
    }
    
    // Interrompe e reinicia o cronômetro
    clearInterval(timerInterval); 
    
    const tempoLimite = getCurrentTimeLimit(); 
    const currentWidth = parseFloat(timeBar.style.width) || 0;
    
    // Calcula o percentual de tempo extra em relação ao tempoLimite
    const percentualExtra = (tempoExtra / tempoLimite) * 100;
    
    // Adiciona o percentual, limitando a 100%
    let newPercent = currentWidth + percentualExtra;
    newPercent = Math.min(newPercent, 100); 

    timeBar.style.transition = 'none'; // Desativa transição para aplicar instantaneamente
    timeBar.style.width = `${newPercent}%`;
    
    // Feedback de cor imediato
    if (newPercent > 50) {
        timeBar.style.backgroundColor = 'var(--cor-sucesso)';
    } else if (newPercent > 20) {
        timeBar.style.backgroundColor = 'var(--cor-secundaria)';
    }
    
    setTimeout(() => {
        timeBar.style.transition = 'width 0.1s linear'; // Reativa transição (assumindo que está no CSS)
        iniciarCronometro(); // Reinicia o cronômetro com o novo ponto inicial (percentual)
    }, 100);
    
    showFeedbackMessage(`⏱️ Tempo prorrogado em ${tempoExtra}s! -${custo} XP`, 'success', 2000);
}

// Função para Mostrar a Resposta Correta (Ajuda)
function mostrarAjuda() {
    if (!gameState.isRapidMode || isTrainingMode) {
        showFeedbackMessage('Ação indisponível no modo Estudo ou Treino.', 'warning', 3000);
        return;
    }
    
    if (!gastarXP(XP_COST_HINT)) {
        showFeedbackMessage(`Você precisa de ${XP_COST_HINT} XP para pedir ajuda!`, 'warning', 3000);
        return;
    }
    
    // Para o cronômetro e desabilita respostas
    clearInterval(timerInterval);
    librasAlert.classList.add('hidden');
    answerOptions.forEach(btn => btn.disabled = true); 
    
    // Encontra o botão correto
    const correctButton = Array.from(answerOptions).find(btn => 
        parseInt(btn.querySelector('.answer-text').textContent) === gameState.currentCorrectAnswer
    );
    
    if (correctButton) {
        correctButton.classList.add('correct');
    }
    
    // Registra como erro (sem pontuação)
    rodadaStats.erros++;
    rodadaStats.acertosSeguidos = 0; 
    gameState.consecutiveErrors++; 
    
    // Feedback visual
    showFeedbackMessage('💡 Resposta Revelada! -250 XP', 'incentive', 3000);
    
    // Não ganha pontuação, apenas avança para a próxima questão
    gameState.currentQuestionIndex++; 
    setTimeout(carregarProximaQuestao, 3000); 
}

// Habilita/Desabilita os botões de ação com base no XP e modo de jogo
function updateActionButtonsState() {
    const isAvailable = gameState.currentScreen === 'game-screen' && gameState.isRapidMode && !isTrainingMode;
    
    const timeCost = gameState.isAcessibilityActive ? XP_COST_EXTEND_ACCESS : XP_COST_EXTEND_NORMAL;
    document.getElementById('extend-time-cost').textContent = timeCost;
    
    btnExtendTime.disabled = !isAvailable || playerXP < timeCost; 
    btnShowAnswer.disabled = !isAvailable || playerXP < XP_COST_HINT;
    
    if (!isAvailable) {
        btnExtendTime.disabled = true;
        btnShowAnswer.disabled = true;
    }
}


// --- LÓGICA DE GERAÇÃO DE QUESTÕES (6 OPERAÇÕES) ---
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gerarAdicao(level) {
    let num1, num2;
    switch (level) {
        case 'easy':
            num1 = getRandomInt(1, 20); num2 = getRandomInt(1, 20); break;
        case 'medium':
            num1 = getRandomInt(20, 100); num2 = getRandomInt(20, 100); break;
        case 'advanced':
            num1 = getRandomInt(100, 500); num2 = getRandomInt(100, 500); break;
    }
    const correctAnswer = num1 + num2;
    return { questao: `${num1} + ${num2} = ?`, correctAnswer: correctAnswer };
}

function gerarSubtracao(level) {
    let num1, num2;
    switch (level) {
        case 'easy':
            num1 = getRandomInt(1, 30); num2 = getRandomInt(1, num1); break;
        case 'medium':
            num1 = getRandomInt(30, 150); num2 = getRandomInt(1, num1); break;
        case 'advanced':
            num1 = getRandomInt(150, 700); num2 = getRandomInt(1, num1); break;
    }
    const correctAnswer = num1 - num2;
    return { questao: `${num1} - ${num2} = ?`, correctAnswer: correctAnswer };
}

function gerarSequenciaTabuada(minBase, maxBase, count = 20) {
    const list = [];
    while (list.length < count) {
        const num1 = getRandomInt(minBase, maxBase);
        const num2 = getRandomInt(0, 10); // Multiplicador de 0 a 10
        const correctAnswer = num1 * num2;
        const q = { questao: `${num1} x ${num2} = ?`, correctAnswer: correctAnswer };
        // Evita duplicatas na lista
        if (!list.some(item => item.questao === q.questao)) {
            list.push(q);
        }
    }
    return list.sort(() => Math.random() - 0.5); 
}

function gerarDivisao(level) {
    let num1, num2;
    switch (level) {
        case 'easy':
            num2 = getRandomInt(2, 5); num1 = num2 * getRandomInt(2, 10); break;
        case 'medium':
            num2 = getRandomInt(6, 10); num1 = num2 * getRandomInt(2, 15); break;
        case 'advanced':
            num2 = getRandomInt(11, 20); num1 = num2 * getRandomInt(5, 25); break;
    }
    const correctAnswer = num1 / num2;
    return { questao: `${num1} ÷ ${num2} = ?`, correctAnswer: correctAnswer };
}

function gerarPotenciacao(level) {
    let base, exp;
    switch (level) {
        case 'easy':
            base = getRandomInt(2, 5); exp = getRandomInt(2, 3); break;
        case 'medium':
            base = getRandomInt(2, 8); exp = getRandomInt(2, 4); break;
        case 'advanced':
            base = getRandomInt(5, 12); exp = getRandomInt(3, 5); break;
    }
    const correctAnswer = Math.pow(base, exp);
    return { questao: `${base}ⁿ (n=${exp}) = ?`, correctAnswer: correctAnswer };
}

function gerarRadiciacao(level) {
    let root, base;
    switch (level) {
        case 'easy':
            root = 2; base = getRandomInt(4, 10); break;
        case 'medium':
            root = getRandomInt(2, 3); base = getRandomInt(10, 20); break;
        case 'advanced':
            root = getRandomInt(3, 4); base = getRandomInt(5, 12); break;
    }
    const correctAnswer = base;
    const power = Math.pow(base, root);
    const rootSymbol = root === 2 ? '√' : `√${root}`;
    return { questao: `${rootSymbol}${power} = ?`, correctAnswer: correctAnswer };
}


function gerarSequenciaQuestoes(operation, level, count = 20) {
    const list = [];
    let gerador;
    
    switch (operation) {
        case 'addition': gerador = gerarAdicao; break;
        case 'subtraction': gerador = gerarSubtracao; break;
        case 'division': gerador = gerarDivisao; break;
        case 'multiplication': return gerarSequenciaTabuada(level === 'easy' ? 0 : level === 'medium' ? 6 : 11, level === 'easy' ? 5 : level === 'medium' ? 10 : 20, count);
        case 'potenciacao': gerador = gerarPotenciacao; break;
        case 'radiciacao': gerador = gerarRadiciacao; break;
        default: return [];
    }
    
    while (list.length < count) {
        const q = gerador(level);
        // Evita duplicatas na lista
        if (!list.some(item => item.questao === q.questao)) {
            list.push(q);
        }
    }
    
    return list.sort(() => Math.random() - 0.5); 
}

// CORREÇÃO: Garante que 4 opções sejam geradas ANTES de filtrar negativos.
function gerarOpcoesPadrao(respostaCorreta, operacao) {
    const opcoes = new Set();
    opcoes.add(respostaCorreta);
    
    // Tenta gerar 3 opções erradas, próximas à resposta
    for (let i = 0; i < 10 && opcoes.size < 4; i++) {
        let erro;
        // Gera erros próximos
        if (Math.random() < 0.5) {
            erro = respostaCorreta + getRandomInt(1, 5);
        } else {
            erro = respostaCorreta - getRandomInt(1, 5);
        }
        opcoes.add(erro);
    }

    // Se ainda faltar, adiciona números aleatórios maiores para garantir 4
    while (opcoes.size < 4) {
        // Gera números aleatórios numa faixa acima da correta (evita negativos)
        opcoes.add(getRandomInt(respostaCorreta + 5, respostaCorreta + 15));
    }
    
    // Garante que não haja números negativos e embaralha e limita a 4
    // O .slice(0, 4) é redundante aqui, mas mantido para segurança
    return Array.from(opcoes)
        .filter(n => n >= 0)
        .sort(() => Math.random() - 0.5)
        .slice(0, 4); 
}

function resetAnswersUI() {
    answerOptions.forEach(btn => {
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
        btn.style.opacity = 1;
        delete btn.dataset.isCorrect; 
    });
}

function updateAnswersUI(questao, respostaCorreta, arrayOpcoes) {
    resetAnswersUI(); 
    
    questionText.innerHTML = questao; 
    gameState.currentCorrectAnswer = respostaCorreta;

    // Se houver menos de 4 opções, oculta as que sobraram (importante para o bug corrigido)
    answerOptions.forEach((btn, index) => {
        const spanText = btn.querySelector('.answer-text');
        if (index < arrayOpcoes.length) {
            spanText.textContent = arrayOpcoes[index];
            btn.dataset.isCorrect = (parseInt(arrayOpcoes[index]) === respostaCorreta).toString(); 
            btn.style.display = 'flex'; // Garante que esteja visível
        } else {
            // Oculta botões de resposta se não houver opção gerada (garantia)
            btn.style.display = 'none'; 
        }
    });

    
    // Atualiza o contador de questões
    const total = gameState.questionList.length;
    const current = gameState.currentQuestionIndex + 1;
    questionCounter.textContent = `Questão: ${current}/${total}`;
    
    updateXPDisplay(); // Atualiza a exibição do XP e o estado dos botões
    iniciarCronometro();
    lerEmVoz(questao);
}

function carregarProximaQuestao() {
    
    if (gameState.currentQuestionIndex < gameState.questionList.length) {
        const q = gameState.questionList[gameState.currentQuestionIndex];
        const opcoes = gerarOpcoesPadrao(q.correctAnswer, gameState.currentOperation);
        updateAnswersUI(q.questao, q.correctAnswer, opcoes);
        
    } else {
        exibirResultados();
    }
}


// --- FEEDBACK MOTIVACIONAL ---
function showFeedbackMessage(message, type, duration) {
    feedbackMessageElement.textContent = message;
    feedbackMessageElement.className = `feedback-message show ${type}`;
    
    setTimeout(() => {
        feedbackMessageElement.classList.remove('show');
    }, duration);
}

function dispararConfete() {
    // Simples placeholder para confetes (pode ser substituído por uma biblioteca)
    confettiContainer.innerHTML = '';
    
    const colors = ['#f9d423', '#ff4e50', '#a1c4fd', '#c3a1fd', '#76ff03'];
    const count = 30;

    for (let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        confetti.style.width = '8px';
        confetti.style.height = '8px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.position = 'absolute';
        confetti.style.borderRadius = '50%';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.top = `${-10 - Math.random() * 50}px`; // Começa acima da tela
        confetti.style.opacity = '0.9';
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        confetti.style.animation = `fall ${Math.random() * 2 + 1}s linear ${Math.random() * 1}s forwards`;
        confettiContainer.appendChild(confetti);
    }
    
    // Adiciona animação CSS para o confete (se não estiver no seu style.css)
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = `
        @keyframes fall {
            to {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(styleSheet);

    setTimeout(() => confettiContainer.innerHTML = '', 3000);
}


// --- FEEDBACK E PONTUAÇÃO (Gamificação) ---
function darFeedback(acertou, botaoClicado) {
    clearInterval(timerInterval);
    librasAlert.classList.add('hidden');
    
    if (isTrainingMode) {
        // Se estiver no modo treino, apenas marca e avança.
        darFeedbackTreinamento(acertou, botaoClicado);
        return;
    }
    
    answerOptions.forEach(btn => btn.disabled = true); 
    
    const baseScore = 100;
    let multiplier = gameState.currentLevel === 'medium' ? 1.5 : gameState.currentLevel === 'advanced' ? 2.0 : 1;
    let comboBonus = 0;
    let bonusTempo = 0;
    
    if (gameState.isRapidMode) {
        const tempoLimite = getCurrentTimeLimit();
        const currentWidth = parseFloat(timeBar.style.width) || 0;
        const tempoUsadoPercentual = 100 - currentWidth;
        
        // Bonus de tempo: Quanto menos tempo usado, maior o bônus.
        bonusTempo = Math.round((baseScore * multiplier) * (1 - (tempoUsadoPercentual / 100)));
        bonusTempo = Math.max(0, bonusTempo); 
    }


    if (acertou) {
        rodadaStats.acertos++;
        rodadaStats.acertosSeguidos++;
        gameState.consecutiveErrors = 0; 
        rodadaStats.acertosSeguidosMax = Math.max(rodadaStats.acertosSeguidosMax, rodadaStats.acertosSeguidos);
        
        dispararConfete(); 
        
        if (rodadaStats.acertosSeguidos >= 3) {
            comboBonus = rodadaStats.acertosSeguidos * 50; 
            showFeedbackMessage(`🔥 COMBO x${rodadaStats.acertosSeguidos}!`, 'incentive', 1500); 
        }
        
        const pontuacaoRodada = Math.round((baseScore * multiplier) + bonusTempo + comboBonus);
        rodadaStats.pontuacao += pontuacaoRodada;
        ganharXP(XP_GAIN_PER_HIT); 
        
        playerScoreElement.textContent = `+${pontuacaoRodada} Pontos! (${Math.floor(rodadaStats.pontuacao)} total)`;
        playerScoreElement.classList.add('combo-active');

        if (botaoClicado) botaoClicado.classList.add('correct');
        
    } else {
        rodadaStats.erros++;
        rodadaStats.acertosSeguidos = 0; 
        gameState.consecutiveErrors++; 
        
        const questao = questionText.textContent;
        const respostaUsuario = botaoClicado ? parseInt(botaoClicado.querySelector('.answer-text').textContent) : 'Tempo Esgotado';
        registrarErro(questao, gameState.currentCorrectAnswer, respostaUsuario);

        if (gameState.consecutiveErrors === 3) {
            showFeedbackMessage('⚠️ Erro, mas não desista! Tente o modo Estudo!', 'warning', 4000);
        }
        
        if (botaoClicado) {
            botaoClicado.classList.add('wrong');
        } 
        
        // Revela o correto
        const correctButton = Array.from(answerOptions).find(btn => 
            parseInt(btn.querySelector('.answer-text').textContent) === gameState.currentCorrectAnswer
        );
        if (correctButton) correctButton.classList.add('correct');
        
        playerScoreElement.textContent = `❌ Erro! Pontuação: ${Math.floor(rodadaStats.pontuacao)}`;
        playerScoreElement.classList.add('combo-active', 'error-feedback');
    }
    
    // Limpa o feedback de pontuação temporário
    setTimeout(() => {
        playerScoreElement.textContent = `${Math.floor(rodadaStats.pontuacao)} Pontos`;
        playerScoreElement.classList.remove('combo-active', 'error-feedback');
    }, acertou ? 1500 : 2500);

    // Lógica de avanço
    gameState.currentQuestionIndex++; 
    setTimeout(carregarProximaQuestao, acertou ? 1500 : 2500); 
}


// --- LÓGICA DE INÍCIO DE JOGO ---
function iniciarJogo() {
    
    isTrainingMode = false;
    gameHeader.querySelector('.btn-quit-game').textContent = 'SAIR'; 
    playerScoreElement.textContent = '0 Pontos';
    
    // Limpa estado da rodada
    gameState.questionList = [];
    gameState.currentQuestionIndex = 0;
    gameState.consecutiveErrors = 0;
    gameState.xpGainedThisRound = 0; 
    
    exibirTela('game-screen'); 
    rodadaStats.acertos = 0; rodadaStats.erros = 0; rodadaStats.pontuacao = 0;
    rodadaStats.acertosSeguidos = 0; rodadaStats.acertosSeguidosMax = 0;
    
    // Atualiza a barra de XP e os botões de ação
    updateXPDisplay(); 

    // Define o tempo máximo base para o jogo (CRUCIAL PARA O CRONÔMETRO)
    let tempoMaximoBase = 15; // Padrão
    const numQuestoes = 20; 

    if (gameState.currentLevel === 'medium') { tempoMaximoBase = 30; } 
    else if (gameState.currentLevel === 'advanced') { tempoMaximoBase = 45; }

    tempoMaximo = tempoMaximoBase;
    
    // Gera a lista de questões
    gameState.questionList = gerarSequenciaQuestoes(gameState.currentOperation, gameState.currentLevel, numQuestoes);
    
    carregarProximaQuestao();
}


// --- LÓGICA DA TELA DE RESULTADOS E RANKING ---
function exibirResultados() {
    exibirTela('result-screen');
    
    const pontuacaoFinal = Math.floor(rodadaStats.pontuacao);
    document.getElementById('final-score').textContent = pontuacaoFinal;
    document.getElementById('total-hits').textContent = rodadaStats.acertos;
    document.getElementById('total-misses').textContent = rodadaStats.erros;
    
    // Exibe XP na tela de resultados
    document.getElementById('xp-gained').textContent = gameState.xpGainedThisRound;
    document.getElementById('xp-total').textContent = playerXP;
    
    const operacao = gameState.currentOperation;
    const recordeAtual = highScores[operacao] || 0;
    
    if (pontuacaoFinal > recordeAtual) {
        highScores[operacao] = pontuacaoFinal;
        salvarHighScores();
        document.getElementById('study-suggestion').innerHTML = `
            🎉 **NOVO RECORDE!** Sua pontuação de ${pontuacaoFinal} superou o recorde anterior de ${recordeAtual}.
        `;
    } else {
        document.getElementById('study-suggestion').textContent = `
            Sua pontuação de ${pontuacaoFinal} não superou o recorde atual de ${recordeAtual} pontos. Tente novamente!
        `;
    }

    // Exibe ou esconde o botão de treino
    if (errosPersistidos.length > 0) { btnTreinarErros.style.display = 'block'; } 
    else { btnTreinarErros.style.display = 'none'; }
}

function renderRankingList() {
    const container = document.getElementById('ranking-list-container');
    const noRecordsMessage = document.getElementById('no-records-message');
    const btnClearRanking = document.getElementById('btn-clear-ranking');
    container.innerHTML = '';
    
    const operations = Object.keys(highScores).filter(op => highScores[op] > 0);
    
    if (operations.length === 0) {
        noRecordsMessage.classList.remove('hidden');
        btnClearRanking.disabled = true;
        return;
    }
    
    noRecordsMessage.classList.add('hidden');
    btnClearRanking.disabled = false;

    operations.sort((a, b) => highScores[b] - highScores[a]);

    operations.forEach(op => {
        const score = highScores[op];
        const element = document.createElement('div');
        element.className = 'info-card ranking-item';
        element.innerHTML = `
            <h3>${op.charAt(0).toUpperCase() + op.slice(1)}</h3>
            <p>Pontuação Máxima: <strong>${score}</strong></p>
        `;
        container.appendChild(element);
    });
}

document.getElementById('btn-clear-ranking').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todos os seus recordes?')) {
        highScores = {};
        salvarHighScores();
        renderRankingList();
    }
});


// --- LÓGICA DE TREINAMENTO DE ERROS ---
function darFeedbackTreinamento(acertou, botaoClicado) {
    answerOptions.forEach(btn => btn.disabled = true);

    if (acertou) {
        if (botaoClicado) botaoClicado.classList.add('correct');
        showFeedbackMessage('✅ Correto! Erro resolvido.', 'success', 1500);
        
        // Remove o erro da lista
        const questaoAtual = questionText.textContent;
        errosPersistidos = errosPersistidos.filter(e => e.questao !== questaoAtual);
        salvarErros();
        
        // Avança para o próximo erro
        gameState.currentQuestionIndex++;
        setTimeout(carregarProximaQuestaoTreinamento, 1500);

    } else {
        if (botaoClicado) {
            botaoClicado.classList.add('wrong');
            // Revela o correto
            const correctButton = Array.from(answerOptions).find(btn => 
                parseInt(btn.querySelector('.answer-text').textContent) === gameState.currentCorrectAnswer
            );
            if (correctButton) correctButton.classList.add('correct');
        }
        showFeedbackMessage('❌ Tente de novo! Não desista.', 'warning', 2500);
        
        // Mantém a questão atual, apenas reinicia o estado
        setTimeout(() => {
            resetAnswersUI();
            iniciarCronometro(); // Reinicia o cronômetro de treino
            gameHeader.querySelector('.btn-quit-game').textContent = 'VOLTAR AO TREINO';
        }, 2500);
    }
}

function renderErrorTrainingList() {
    const container = document.getElementById('error-list-container');
    const message = document.getElementById('error-count-message');
    const btnStartTraining = document.getElementById('btn-start-training');
    const btnClearErrors = document.getElementById('btn-clear-errors');

    carregarErros(); // Recarrega os erros

    if (errosPersistidos.length === 0) {
        message.textContent = 'Você não tem erros registrados para treino.';
        btnStartTraining.disabled = true;
        btnClearErrors.disabled = true;
        container.innerHTML = '';
        return;
    }
    
    message.textContent = `Você tem ${errosPersistidos.length} erro(s) salvo(s) para treino.`;
    btnStartTraining.disabled = false;
    btnClearErrors.disabled = false;
    
    container.innerHTML = '';
    
    // Lista os últimos 5 erros para visualização
    const ultimosErros = errosPersistidos.slice(-5).reverse();
    ultimosErros.forEach(erro => {
        const element = document.createElement('div');
        element.className = 'info-card error-item';
        element.innerHTML = `
            <p><strong>Questão:</strong> ${erro.questao}</p>
            <p><strong>Sua Resposta:</strong> <span class="wrong-answer">${erro.respostaUsuario}</span></p>
            <p><strong>Resposta Correta:</strong> <span class="correct-answer">${erro.respostaCorreta}</span></p>
        `;
        container.appendChild(element);
    });
}

function iniciarTreinamento() {
    if (errosPersistidos.length === 0) {
        alert('Nenhum erro salvo para treino.');
        exibirTela('home-screen');
        return;
    }
    
    isTrainingMode = true;
    gameState.questionList = errosPersistidos.map(e => ({
        questao: e.questao,
        correctAnswer: e.respostaCorreta
    }));
    gameState.currentQuestionIndex = 0;
    
    exibirTela('game-screen');
    gameHeader.querySelector('.btn-quit-game').textContent = 'VOLTAR AO TREINO'; 
    
    // Força o modo estudo (sem cronômetro/pontuação)
    gameState.isRapidMode = false;
    document.getElementById('mode-rapido').classList.remove('active');
    document.getElementById('mode-estudo').classList.add('active');
    updateActionButtonsState();

    carregarProximaQuestaoTreinamento();
}

function carregarProximaQuestaoTreinamento() {
     if (gameState.currentQuestionIndex < gameState.questionList.length) {
        const q = gameState.questionList[gameState.currentQuestionIndex];
        // Gera opções com base na resposta correta do erro
        const opcoes = gerarOpcoesPadrao(q.correctAnswer, 'Treino'); 
        updateAnswersUI(q.questao, q.correctAnswer, opcoes);
        
    } else {
        showFeedbackMessage('Parabéns! Você resolveu todos os seus erros salvos.', 'success', 4000);
        exibirTela('error-training-screen');
        renderErrorTrainingList();
    }
}

document.getElementById('btn-clear-errors').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar todos os seus erros salvos?')) {
        errosPersistidos = [];
        salvarErros();
        renderErrorTrainingList();
    }
});

document.getElementById('btn-start-training').addEventListener('click', iniciarTreinamento);
btnTreinarErros.addEventListener('click', () => exibirTela('error-training-screen'));

// --- CONEXÃO DE EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Conexão dos botões de operação (Fluxo 1 -> 2)
    operationButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            gameState.currentOperation = btn.dataset.operation;
            document.getElementById('level-title').textContent = btn.querySelector('h3').textContent;
            exibirTela('level-screen');
        });
    });

    // Conexão dos botões de nível (Fluxo 2 -> 3)
    levelButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            gameState.currentLevel = btn.dataset.level;
            iniciarJogo();
        });
    });

    // Botões de Voltar e Sair (Fluxo inverso)
    btnVoltar.forEach(btn => btn.addEventListener('click', () => exibirTela('home-screen')));
    btnVoltarHome.forEach(btn => btn.addEventListener('click', () => exibirTela('home-screen')));
    btnQuitGame.addEventListener('click', () => {
        // Garante que o cronômetro pare ao sair do jogo
        clearInterval(timerInterval); 
        
        if (isTrainingMode) {
            exibirTela('error-training-screen');
            isTrainingMode = false; // Sai do modo treino
        } else {
            exibirTela('home-screen');
        }
    });

    // Botões de Resposta
    answerOptions.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (gameState.currentScreen === 'game-screen' && !btn.disabled) {
                const respostaUsuario = parseInt(btn.querySelector('.answer-text').textContent);
                const acertou = respostaUsuario === gameState.currentCorrectAnswer;
                darFeedback(acertou, btn);
            }
        });
    });

    // CORREÇÃO: Adiciona suporte a teclado para acessibilidade e agilidade
    document.addEventListener('keydown', (e) => {
        // Verifica se estamos na tela de jogo
        if (gameState.currentScreen === 'game-screen') {
            const key = e.key;
            let targetButton = null;

            if (key === '1' || key === '2' || key === '3' || key === '4') {
                // Mapeia a tecla para o índice do botão (1 -> index 0, 2 -> index 1, etc.)
                const index = parseInt(key) - 1; 
                if (answerOptions[index] && answerOptions[index].style.display !== 'none' && !answerOptions[index].disabled) {
                    targetButton = answerOptions[index];
                }
            } else if (key === 't' || key === 'T') {
                // Tecla de atalho para estender tempo
                e.preventDefault(); 
                btnExtendTime.click();
            } else if (key === 'a' || key === 'A') {
                // Tecla de atalho para ajuda
                e.preventDefault(); 
                btnShowAnswer.click();
            }

            if (targetButton) {
                // Simula o clique no botão de resposta correspondente
                targetButton.click();
            }
        }
    });

    // Toggle Modo Rápido/Estudo
    document.getElementById('mode-rapido').addEventListener('click', () => {
        gameState.isRapidMode = true;
        document.getElementById('mode-rapido').classList.add('active');
        document.getElementById('mode-estudo').classList.remove('active');
        // Se estiver em jogo, reinicia o cronômetro para iniciar a contagem
        if (gameState.currentScreen === 'game-screen') iniciarCronometro(); 
        updateActionButtonsState();
    });

    document.getElementById('mode-estudo').addEventListener('click', () => {
        gameState.isRapidMode = false;
        document.getElementById('mode-rapido').classList.remove('active');
        document.getElementById('mode-estudo').classList.add('active');
        // Se estiver em jogo, para o cronômetro e o deixa verde
        if (gameState.currentScreen === 'game-screen') iniciarCronometro(); 
        updateActionButtonsState();
    });
    
    // Toggle Modo Noturno 
    document.getElementById('toggle-night-mode').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    // Toggle Leitura de Voz
    document.getElementById('toggle-voice-read').addEventListener('click', (e) => {
        gameState.isVoiceReadActive = !gameState.isVoiceReadActive;
        const btn = e.currentTarget;
        if (gameState.isVoiceReadActive) {
            btn.classList.add('active');
            btn.innerHTML = '<span class="icon">🔊</span> Leitura de Voz (ON)';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<span class="icon">🔊</span> Leitura de Voz';
            if (synth) synth.cancel();
        }
        updateXPDisplay(); 
    });
    
    // Conexão do VLibras (Observa mudanças de classe para ativar Acessibilidade)
    const vlibrasPluginWrapper = document.querySelector('.vw-plugin-wrapper');
    if (vlibrasPluginWrapper) {
        const observer = new MutationObserver(() => {
            // A classe 'vw-started' é adicionada ao elemento pai do widget quando ele é ativado.
            const vlibrasIsActive = document.querySelector('.vw-status-bar.vw-started');
            if (!!vlibrasIsActive !== gameState.isAcessibilityActive) {
                gameState.isAcessibilityActive = !!vlibrasIsActive;
                updateXPDisplay();
            }
        });
        observer.observe(vlibrasPluginWrapper.parentElement, { attributes: true, subtree: true });
    }

    // Conexão dos botões de ação do jogo
    btnExtendTime.addEventListener('click', estenderTempo);
    btnShowAnswer.addEventListener('click', mostrarAjuda);

    // Botão de Recordes
    document.getElementById('btn-show-ranking').addEventListener('click', () => exibirTela('ranking-screen'));
    
    // Carregamento inicial de dados
    carregarHighScores();
    carregarErros();
    
    // Renderiza a lista de erros na tela de treino ao carregar
    renderErrorTrainingList();
});