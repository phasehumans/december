import { describe, expect, test } from 'bun:test'

import { getSlashMenuPlacement } from '../src/features/home/slash/slashMenuPlacement'

// #634: the slash menu stays in the part of the screen the phone keyboard leaves free
describe('slash menu placement', () => {
    test('desktop with room under the box: opens under the text, no height limit needed', () => {
        // a 900px window, the box from 300 to 420
        expect(
            getSlashMenuPlacement({
                boxTop: 300,
                boxBottom: 420,
                viewportTop: 0,
                viewportHeight: 900,
                placement: 'auto',
            })
        ).toEqual({ side: 'bottom', maxHeight: 544 })
    })

    test('little room under the box and more above: opens above', () => {
        expect(
            getSlashMenuPlacement({
                boxTop: 600,
                boxBottom: 720,
                viewportTop: 0,
                viewportHeight: 900,
                placement: 'auto',
            })
        ).toEqual({ side: 'top', maxHeight: 584 })
    })

    test('phone keyboard open: the room is counted to the keyboard, not to the window', () => {
        // a 844px phone. the keyboard leaves 480px, and the box sits from 150 to 270.
        // to the window edge there are 574px under the box; to the keyboard only 210
        expect(
            getSlashMenuPlacement({
                boxTop: 150,
                boxBottom: 270,
                viewportTop: 0,
                viewportHeight: 480,
                placement: 'auto',
            })
        ).toEqual({ side: 'bottom', maxHeight: 274 })
    })

    test('phone keyboard open with the box at the keyboard: opens above and fits there', () => {
        expect(
            getSlashMenuPlacement({
                boxTop: 330,
                boxBottom: 470,
                viewportTop: 0,
                viewportHeight: 480,
                placement: 'auto',
            })
        ).toEqual({ side: 'top', maxHeight: 314 })
    })

    test('a page the phone moved up: the free part starts at the viewport offset', () => {
        // the session box always opens above. the visible part runs from 300 to 780
        expect(
            getSlashMenuPlacement({
                boxTop: 660,
                boxBottom: 780,
                viewportTop: 300,
                viewportHeight: 480,
                placement: 'top',
            })
        ).toEqual({ side: 'top', maxHeight: 344 })
    })

    test('very little room: the menu keeps three rows and scrolls inside', () => {
        expect(
            getSlashMenuPlacement({
                boxTop: 60,
                boxBottom: 180,
                viewportTop: 0,
                viewportHeight: 200,
                placement: 'top',
            })
        ).toEqual({ side: 'top', maxHeight: 96 })
    })
})
