declare module "nexusui" {
    export type NexusNumberOptions = {
        size?: [number, number];
        value?: number;
        min?: number;
        max?: number;
        step?: number;
    };

    export class Number {
        constructor(target: string | HTMLElement, options?: NexusNumberOptions);
        value: number;
        min: number;
        max: number;
        step: number;
        decimalPlaces: number;
        hasMoved?: boolean;
        colors: {
            fill: string;
            dark: string;
            light: string;
            accent: string;
        };
        element: HTMLInputElement;
        on(event: "change" | "click" | "release", handler: (value?: number) => void): void;
        passiveUpdate(value: number): void;
        render(): void;
        colorInterface(): void;
        destroy(): void;
    }

    const Nexus: {
        Number: typeof Number;
    };

    export default Nexus;
}
