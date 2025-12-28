import type { GetStaticProps } from "next";

type Props = {
  message: string;
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  return {
    props: {
      message: "Hello depuis une page SSG avec getStaticProps !",
    },
  };
};

export default function About({ message }: Props) {
  return <h1>{message}</h1>;
}
