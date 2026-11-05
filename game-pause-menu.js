/**
 * O menu de pausa só deve ficar oculto quando outro estado de interface já
 * cobre a tela: jogo capturado, inventário aberto, chat aberto ou tela de morte.
 *
 * O chat entra aqui porque digitar solta o mouse sem pausar nada: o mundo
 * continua rodando atrás (como no Minecraft) e o menu não pode aparecer.
 */
export function shouldShowPauseMenu({ locked = false, inventoryOpen = false, dead = false, chatOpen = false } = {}) {
    return !locked && !inventoryOpen && !dead && !chatOpen;
}

export function pauseMenuDisplay(state) {
    // 'grid' (e não 'flex'): o cartão de pausa é centralizado pelo
    // `place-items` do #menu, sem precisar de margem.
    return shouldShowPauseMenu(state) ? 'grid' : 'none';
}
