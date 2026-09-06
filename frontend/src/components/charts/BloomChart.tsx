import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface BloomDistributionItem {
  level: string;
  percentage: number;
}

export default function BloomChart({ data }: { data: BloomDistributionItem[] }) {
  return (
    <Bar
      data={{
        labels: data.map((d) => d.level),
        datasets: [
          {
            label: "Question share (%)",
            data: data.map((d) => d.percentage),
            backgroundColor: "#3b6fed",
            borderRadius: 6,
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 100 } },
      }}
    />
  );
}
