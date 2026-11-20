// Wrangler bundles *.txt files as text modules (default module rules), so the Worker can import them as a string.
declare module "*.txt" {
  const text: string;
  export default text;
}
