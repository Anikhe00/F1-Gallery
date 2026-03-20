import { useState, useEffect } from "react";
import { client } from "../library/sanity";

export function useDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // GROQ query to fetch all drivers with their moments
    const query = `*[_type == "driver"] | order(number asc) {
      _id,
      name,
      number,
      team,
      teamColor,
      "image": image.asset->url,
      "moments": moments[]-> {
        _id,
        title,
        date,
        description,
        type,
        "imageUrl": image.asset->url,
        videoUrl,
        radio
      }
    }`;

    client
      .fetch(query)
      .then((data) => {
        // Transform the data to match your component structure
        const transformedData = data.map((driver) => ({
          id: driver._id,
          name: driver.name,
          number: driver.number,
          team: driver.team,
          teamColor: driver.teamColor,
          image: driver.image,
          moments: driver.moments
            ? driver.moments.map((moment) => ({
                id: moment._id,
                type: moment.type,
                title: moment.title,
                date: new Date(moment.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
                description: moment.description,
                imageUrl: moment.imageUrl,
                videoUrl: moment.videoUrl,
                radio: moment.radio,
              }))
            : [],
        }));

        setDrivers(transformedData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching drivers:", err);
        setError(err);
        setLoading(false);
      });
  }, []);

  return { drivers, loading, error };
}
