import { describe, expect, it } from 'bun:test'

import {
    extractDeclarations,
    buildDeclarationMap,
} from '../../src/modules/generation/context-indexer'

describe('context-indexer.unit', () => {
    it('should extract exported interfaces', () => {
        const code = `
            import React from 'react'
            
            export interface Property {
                id: string;
                title: string;
                price: number;
            }

            export interface PropertyCardProps {
                property: Property;
                onSelect?: (id: string) => void;
            }
        `
        const result = extractDeclarations(code)
        expect(result).toContain('export interface Property {')
        expect(result).toContain('export interface PropertyCardProps {')
        expect(result).toContain('property: Property;')
    })

    it('should extract exported types', () => {
        const code = `
            export type ViewMode = 'grid' | 'list';
            export type Listing = {
                id: string;
                name: string;
            };
        `
        const result = extractDeclarations(code)
        expect(result).toContain("export type ViewMode = 'grid' | 'list';")
        expect(result).toContain('export type Listing = {')
    })

    it('should extract component function signatures', () => {
        const code = `
            import React from 'react'

            export interface CardProps {
                title: string;
            }

            export default function PropertyCard({ title }: CardProps) {
                return <div>{title}</div>
            }

            export const PropertyList = (props: { items: string[] }) => {
                return <ul>{props.items.map(i => <li key={i}>{i}</li>)}</ul>
            }
        `
        const result = extractDeclarations(code)
        expect(result).toContain('export default function PropertyCard({ title }: CardProps)')
        expect(result).toContain('export const PropertyList = (props: { items: string[] })')
    })

    it('should build a declaration map from a files record', () => {
        const files = {
            'package.json': '{}',
            'src/index.css': '@import "tailwindcss";',
            'src/types.ts': 'export type ID = string;',
            'src/components/Card.tsx': `
                export interface CardProps { title: string; }
                export default function Card(props: CardProps) { return null; }
            `,
        }

        const map = buildDeclarationMap(files)
        expect(map['package.json']).toBeUndefined()
        expect(map['src/index.css']).toBeUndefined()
        expect(map['src/types.ts']).toBe('export type ID = string;')
        expect(map['src/components/Card.tsx']).toContain('export interface CardProps {')
        expect(map['src/components/Card.tsx']).toContain(
            'export default function Card(props: CardProps)'
        )
    })
})
