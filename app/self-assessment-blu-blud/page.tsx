import { auth } from "@/auth";
import HomeClient from "@/app/home-client";

const Home = async () => {
  const session = await auth();

  return <HomeClient session={session} />;
};

export default Home;