// Higiene do código: as três sobras que aparecem sozinhas com o tempo —
// import que ninguém usa, `console.log` esquecido e arquivo que ninguém importa.
//
// São baratas de remover hoje e caras depois: import órfão faz o leitor achar que
// existe dependência, `console.log` vaza dado para o console do jogador e arquivo
// morto é código que continua sendo lido e nunca executado. Nenhuma das três dá
// erro — por isso precisa de teste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const listOf = (extension, directory = '.') => readdirSync(path.join(ROOT, directory), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(extension))
    .map(entry => path.join(directory, entry.name))
    .sort();

// Código que vai para o navegador (vendor/ é de terceiros, fica de fora).
const SHIPPED = [...listOf('.js')];
// Este próprio arquivo fica de fora: os casos de teste abaixo são imports de
// mentira, dentro de strings, e o detector os leria como código real.
const SOURCES = [...SHIPPED, ...listOf('.mjs', 'tools'), ...listOf('.mjs', 'tests')]
    .filter(file => !String(file).endsWith('hygiene.test.mjs'));

/** Nomes importados num módulo que não aparecem em nenhum outro lugar dele. */
export function orphanImports(source) {
    const orphans = [];

    for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g)) {
        const names = match[1]
            .split(',')
            .map(part => part.split(/\bas\b/).pop().trim())
            .filter(Boolean);
        for (const name of names) {
            const used = new RegExp(`\\b${name}\\b`).test(source.slice(0, match.index) + source.slice(match.index + match[0].length));
            if (!used) orphans.push({ name, from: match[2] });
        }
    }
    // import default e namespace também podem sobrar
    for (const match of source.matchAll(/import\s+(\*\s+as\s+)?(\w+)\s+from\s*['"]([^'"]+)['"];?/g)) {
        const name = match[2];
        if (name === 'from') continue;
        const rest = source.slice(0, match.index) + source.slice(match.index + match[0].length);
        if (!new RegExp(`\\b${name}\\b`).test(rest)) orphans.push({ name, from: match[3] });
    }
    return orphans;
}

test('o detector de import órfão funciona (não é um teste que sempre passa)', () => {
    assert.deepEqual(orphanImports("import { a, b } from './x.js';\nconsole.log(a);"), [{ name: 'b', from: './x.js' }]);
    assert.deepEqual(orphanImports("import { a } from './x.js';\na();"), []);
    assert.deepEqual(orphanImports("import {\n    a,\n    b as c,\n} from './x.js';\nc();"), [{ name: 'a', from: './x.js' }]);
    assert.deepEqual(orphanImports("import padrao from './x.js';"), [{ name: 'padrao', from: './x.js' }]);
    assert.deepEqual(orphanImports("import * as tudo from './x.js';\ntudo.a();"), []);
});

test('nenhum módulo importa o que não usa', () => {
    const report = [];
    for (const file of SOURCES) {
        for (const orphan of orphanImports(read(file))) {
            report.push(`${file}: "${orphan.name}" de ${orphan.from}`);
        }
    }
    assert.deepEqual(report, [], `imports órfãos:\n${report.join('\n')}`);
});

test('nada de console.log no código que vai para o navegador', () => {
    const report = [];
    for (const file of SHIPPED) {
        const lines = read(file).split('\n');
        lines.forEach((line, index) => {
            if (/console\.log\s*\(/.test(line) && !/^\s*\/\//.test(line)) report.push(`${file}:${index + 1}: ${line.trim()}`);
        });
    }
    // console.warn/error são diagnóstico de verdade; console.log é sobra de debug.
    assert.deepEqual(report, [], `console.log esquecido:\n${report.join('\n')}`);
});

test('nenhum `debugger` esquecido', () => {
    const report = [];
    for (const file of SHIPPED) {
        const lines = read(file).split('\n');
        lines.forEach((line, index) => {
            if (/^\s*debugger\s*;?/.test(line)) report.push(`${file}:${index + 1}`);
        });
    }
    assert.deepEqual(report, []);
});

test('todo módulo é importado por alguém (sem arquivo morto)', () => {
    const entry = new Set(['service-worker.js']); // registrado, não importado
    const html = read('index.html');
    const report = [];

    for (const file of SHIPPED) {
        const name = path.basename(file);
        if (entry.has(name)) continue;
        const referenced = SOURCES.some(source => source !== file
            && new RegExp(`['"]\\./${name.replace('.', '\\.')}['"]`).test(read(source)));
        const loadedByHtml = html.includes(`src="${name}"`) || html.includes(`src="${name}?v=`);
        if (!referenced && !loadedByHtml) report.push(name);
    }
    assert.deepEqual(report, [], `módulos que ninguém carrega:\n${report.join('\n')}`);
});

test('o código do jogo não tem sobra de sintonizador desligado', () => {
    // Constante de debug com valor fixo `false` é código morto com cara de vivo:
    // parece uma opção e nunca liga.
    const report = [];
    for (const file of SHIPPED) {
        const source = read(file);
        for (const match of source.matchAll(/const\s+([A-Z0-9_]*DEBUG[A-Z0-9_]*)\s*=\s*(false|true)\s*;/g)) {
            report.push(`${file}: ${match[1]} = ${match[2]}`);
        }
    }
    assert.deepEqual(report, [], `constantes de debug fixas:\n${report.join('\n')}`);
});
