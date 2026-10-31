/** Tamanho responsivo compartilhado pelas grades do inventário. */
export const INVENTORY_SLOT_SIZE_VAR = '--inv-slot-size';

export function craftGridTemplateColumns(columns) {
    if (!Number.isInteger(columns) || columns < 1) {
        throw new RangeError('craftGridTemplateColumns exige um inteiro positivo');
    }
    return `repeat(${columns}, var(${INVENTORY_SLOT_SIZE_VAR}))`;
}
