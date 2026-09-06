import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function CoverageChart({ covered, missing }: { covered: number; missing: number }) {
  return (
    <Doughnut
      data={{
        labels: ["Covered topics", "Missing topics"],
        datasets: [
          {
            data: [covered, missing],
            backgroundColor: ["#22c55e", "#f43f5e"],
          },
        ],
      }}
      options={{ responsive: true, plugins: { legend: { position: "bottom" } } }}
    />
  );
}
