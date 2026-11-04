// Animação do braço/item na tela em primeira pessoa.
//
// Duas fontes se somam para mover a mão:
//
// - **mineração** (`mining`/`phase`): laço contínuo enquanto o botão esquerdo
//   fica pressionado sobre um bloco;
// - **golpe** (`punch`): balanço único, disparado a cada ação que "bate" —
//   colocar bloco, abrir porta e, principalmente, **quebrar** bloco.
//
// O golpe é o que salva os blocos de quebra instantânea (grama alta, dureza 0):
// o laço de mineração dura um único quadro e nunca chegaria a aparecer, então
// sem o `punch` o braço ficava parado enquanto o bloco desaparecia.

export const PUNCH_SECONDS = 0.28;
const MINING_SMOOTHING = 12;
const MINING_PHASE_SPEED = 9;
const SWAP_SECONDS = 0.25;

export function createHandAnimation() {
    return { mining: 0, phase: 0, punch: 0, sw: 1, eat: 0 };
}

// Avança o estado no tempo. `mining` é o laço contínuo (botão esquerdo sobre um
// bloco); separado de `punch` para o golpe poder acontecer mesmo sem laço.
export function advanceHandAnimation(hand, dt, { mining = false } = {}) {
    const target = mining ? 1 : 0;
    hand.mining += (target - hand.mining) * Math.min(1, MINING_SMOOTHING * dt);
    if (mining) hand.phase += dt * MINING_PHASE_SPEED;
    hand.punch = Math.max(0, hand.punch - dt / PUNCH_SECONDS);
    hand.sw = Math.min(1, hand.sw + dt / SWAP_SECONDS);
    return hand;
}

// Deslocamento do braço no quadro: 0 = parado, 1 = fim do golpe.
export function handSwingAmount(hand) {
    const mining = hand.mining * Math.abs(Math.sin(hand.phase));
    // sem golpe em andamento, zero de verdade (sin(π) devolve ~1e-16)
    const punch = hand.punch > 0 ? Math.sin((1 - hand.punch) * Math.PI) : 0;
    const dip = (1 - hand.sw) * (1 - hand.sw) * 0.5;
    return { mining, punch, swing: Math.max(mining, punch), dip };
}

// A fase do laço de mineração avança em radianos; o braço chega ao fim de cada
// golpe em `π/2 + kπ`. Contar essas passagens é o que dita o som da batida —
// assim o som acompanha exatamente o movimento, e não um cronômetro paralelo.
const STRIKE_PEAK = Math.PI / 2;

export function countStrikes(fromPhase, toPhase) {
    if (!Number.isFinite(fromPhase) || !Number.isFinite(toPhase)) return 0;
    if (!(toPhase > fromPhase)) return 0;
    const peaks = phase => Math.floor((phase - STRIKE_PEAK) / Math.PI);
    const count = peaks(toPhase) - peaks(fromPhase);
    // quadro muito longo não pode virar rajada de batidas
    return Math.max(0, Math.min(2, count));
}

// Dispara um golpe (idempotente: repetir só reinicia o balanço).
export function startPunch(hand) {
    hand.punch = 1;
    return hand;
}
