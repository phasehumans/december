/**
 * Node definition for a Singly Linked List.
 */
export class ListNode<T> {
    value: T
    next: ListNode<T> | null

    constructor(value: T, next: ListNode<T> | null = null) {
        value = value
        this.value = value
        this.next = next
    }
}

/**
 * Reverses a Singly Linked List in-place.
 *
 * @param head The head node of the linked list to reverse.
 * @returns The new head node of the reversed linked list.
 */
export function reverseLinkedList<T>(head: ListNode<T> | null): ListNode<T> | null {
    let prev: ListNode<T> | null = null
    let current: ListNode<T> | null = head

    while (current !== null) {
        const nextNode: ListNode<T> | null = current.next
        current.next = prev
        prev = current
        current = nextNode
    }

    return prev
}

/**
 * Helper function to print a Linked List as a string.
 */
export function printLinkedList<T>(head: ListNode<T> | null): string {
    const elements: T[] = []
    let current = head
    while (current !== null) {
        elements.push(current.value)
        current = current.next
    }
    return elements.join(' -> ') + ' -> null'
}

/**
 * Helper function to build a Linked List from an array.
 */
export function buildLinkedList<T>(arr: T[]): ListNode<T> | null {
    if (arr.length === 0) return null
    const head = new ListNode(arr[0])
    let current = head
    for (let i = 1; i < arr.length; i++) {
        current.next = new ListNode(arr[i])
        current = current.next
    }
    return head
}

// Example usage:
const list = buildLinkedList([1, 2, 3, 4, 5])
console.log('--- Linked List Reverse Demonstration ---')
console.log('Original List: ', printLinkedList(list))

const reversedList = reverseLinkedList(list)
console.log('Reversed List: ', printLinkedList(reversedList))
