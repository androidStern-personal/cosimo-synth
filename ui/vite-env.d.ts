declare module "*.css?inline" {
    const cssText: string;
    export default cssText;
}

interface ImportMetaEnv {
    readonly VITE_COSIMO_DEVELOPER_SETTINGS?: string;
}
