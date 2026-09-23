/** Scoped component styles are bundled as strings, including in plugin shadow roots. */
declare module "*.css?inline" {
    const css: string;
    export default css;
}
