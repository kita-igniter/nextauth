import { useContext, useEffect } from "react";
import { AuthContext } from "../../contexts/AuthContext";
import { useCan } from "../../hooks/useCan";
import { setupAPIClient } from "../../services/api";
import { api } from "../../services/apiClient";
import { withSSRAuth } from "../../utils/withSSRAuth";

export default function Dashboard() {
  const { user } = useContext(AuthContext);

  const userCanSeeMetrics = useCan({
    permissions: ["metrics.list"]
  });
  
  useEffect(() => {
    api.get("/me").then(res => console.log(res))
    .catch(err => console.log(err));
  }, []);

  return (
    <>
      <h1>Dashboard: {user?.email}</h1>

      { userCanSeeMetrics && <div>Métricas</div>}
    </>
  ); 
}

export const getServerSideProps = withSSRAuth(async (ctx) => {
  const apiClient = setupAPIClient(ctx);
  const res = await apiClient.get("/me");   

  console.log(res.data);
  
  return {
    props: {}
  }
});