import axios, { AxiosError } from "axios";
import { setCookie, parseCookies } from "nookies";
import { signOut } from "../contexts/AuthContext";

let isRefreshing = false;
let failedRequestsQueue = [];

export function setupAPIClient(ctx = undefined) {
  let cookies = parseCookies(ctx);

  interface AxiosErrorResponse {
    code: string;
  }

  const api = axios.create({
    baseURL: "http://localhost:3333",
    headers: {
      Authorization: `Bearer ${cookies["nextauth.token"]}`,
    },
  });

  api.interceptors.response.use(
    (res) => {
      return res;
    },
    (error: AxiosError<AxiosErrorResponse>) => {
      if (error.response.status === 401) {
        if (error.response.data?.code === "token.expired") {
          cookies = parseCookies(ctx);
          const { "nextauth.refreshToken": refreshToken } = cookies;
          const originalConfig = error.config;

          if (!isRefreshing) {
            isRefreshing = true;
            console.log("Refreshing");
            api
              .post("/refresh", {
                refreshToken,
              })
              .then((res) => {
                const { token } = res.data;

                setCookie(ctx, "nextauth.token", token, {
                  maxAge: 60 * 60 * 24 * 30, // 30 days
                  path: "/",
                });
                setCookie(ctx, "nextauth.refreshToken", res.data.refreshToken, {
                  maxAge: 60 * 60 * 24 * 30, // 30 days
                  path: "/",
                });

                api.defaults.headers["Authorization"] = `Bearer ${token}`;

                failedRequestsQueue.forEach((req) => req.onSuccess(token));
                failedRequestsQueue = [];
              })
              .catch((err) => {
                failedRequestsQueue.forEach((req) => req.onFailure(err));
                failedRequestsQueue = [];

                //Browser
                if (!ctx) {
                  signOut();
                }
              })
              .finally(() => {
                isRefreshing = false;
              });
          }

          return new Promise((resolve, reject) => {
            failedRequestsQueue.push({
              onSuccess: (token: string) => {
                originalConfig.headers["Authorization"] = `Bearer ${token}`;
                resolve(api(originalConfig));
              },
              onFailure: (err: AxiosError) => {
                reject(err);
              },
            });
          });
        } else {
          //Browser
          if (!ctx) {
            signOut();
          }
        }
      }
      return Promise.reject(error);
    }
  );
  return api;
}
