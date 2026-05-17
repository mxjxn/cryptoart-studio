// Mock next/image for Storybook — renders plain <img>
const Image = (props: any) => {
  // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
  return <img {...props} />;
};
export default Image;
