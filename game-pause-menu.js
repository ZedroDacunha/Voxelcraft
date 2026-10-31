/**
 * O menu de pausa só deve ficar oculto quando outro estado de interface já
 * cobre a tela: jogo capturado, inventário aberto ou tela de morte.
 */
export function shouldShowPauseMenu({ locked = false, inventoryOpen = false, dead = false } = {}) {
    return !locked && !inventoryOpen && !dead;
}

export function pauseMenuDisplay(state) {
    return shouldShowPauseMenu(state) ? 'flex' : 'none';
}
