const DriversCard = ({ img, name, number }) => {
  return (
    <div
      className={`px-4 pt-4 pb-6 bg-white flex flex-col gap-4 rotate-2 shadow-xs cursor-pointer hover:rotate-0 hover:shadow-sm`}
    >
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
