// Mock next/link for Storybook
const Link = ({ children, ...props }: any) => <a {...props}>{children}</a>;
export default Link;
