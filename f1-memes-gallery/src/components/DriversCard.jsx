import Pin from "./Pin";

const DriversCard = ({ img, name, number, teamColor, className }) => {
  return (
    <div
      className={`px-4 pt-4 pb-6 bg-white flex flex-col gap-4 shadow-xs cursor-pointer transition-transform duration-300 hover:rotate-0 hover:shadow-sm ${className}`}
    >
      <div className="absolute top-[-28px] left-1/2 -translate-x-1/2">
        <Pin color={teamColor} />
      </div>
      <div className="bg-red-300">
        <img
          src={img}
          alt=""
          className="h-[320px] lg:h-[280px] w-full object-cover"
        />
      </div>
      <div className="flex flex-row justify-between items-center">
        <p className="text-xl font-medium">{name}</p>
        <p className="text-lg">#{number}</p>
      </div>
    </div>
  );
};

export default DriversCard;
