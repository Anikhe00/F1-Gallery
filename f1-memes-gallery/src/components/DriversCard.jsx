import Pin from "./Pin";

const DriversCard = ({ img, name, number, teamColor }) => {
  return (
    <div
      className={`px-4 pt-4 pb-6 bg-white flex flex-col gap-4 rotate-0 shadow-xs cursor-pointer hover:rotate-0 hover:shadow-sm`}
    >
      <div className="absolute top-[-28px] left-1/2 -translate-x-1/2">
        <Pin color={teamColor} />
      </div>
      <div className="bg-red-300">
        <img src={img} alt="" className="h-[280px] w-full object-cover" />
      </div>
      <div className="flex flex-row justify-between">
        <p>{name}</p>
        <p>#{number}</p>
      </div>
    </div>
  );
};

export default DriversCard;
