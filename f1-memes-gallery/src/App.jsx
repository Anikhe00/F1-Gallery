import DriversCard from "./components/DriversCard";
import { useDrivers } from "./hooks/useDrivers";

const Homepage = () => {
  const { drivers, loading, error } = useDrivers();
  // const [selectedDriver, setSelectedDriver] = useState(null);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="bg-rose-50 w-full h-dvh flex flex-col px-25 py-16 overflow-scroll">
      {/* <div>
        <img src="" alt="" />
        <div>
          <h1>F1 Memes Gallery</h1>
          <p>
            The ultimate collection of F1 memes, radio transcripts, and videos
          </p>
        </div>
      </div> */}

      <div className="grid grid-cols-4 gap-10 h-full">
        {drivers.map((driver) => (
          <DriversCard
            key={driver.id}
            img={driver.image}
            name={driver.name}
            number={driver.number}
            teamColor={driver.teamColor}
          />
        ))}
      </div>
    </div>
  );
};

export default Homepage;
