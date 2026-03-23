import DriversCard from "./components/DriversCard";
import { useDrivers } from "./hooks/useDrivers";
import NavBar from "./layout/NavBar";
import Main from "./layout/Main";

const Homepage = () => {
  const { drivers, loading, error } = useDrivers();
  // const [selectedDriver, setSelectedDriver] = useState(null);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="bg-rose-50 w-full h-dvh flex flex-col">
      <NavBar />

      <Main>
        <div className="flex flex-col gap-8 md:grid lg:grid md:grid-cols-2 lg:grid-cols-4 h-full">
          {drivers.map((driver, index) => (
            <DriversCard
              key={driver.id}
              img={driver.image}
              name={driver.name}
              number={driver.number}
              teamColor={driver.teamColor}
              className={index % 2 === 0 ? "rotate-[-3deg]" : "rotate-[3deg]"}
            />
          ))}
        </div>
      </Main>
    </div>
  );
};

export default Homepage;
