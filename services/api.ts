import axios, {AxiosError} from "axios";
import { setCookie, parseCookies } from "nookies";

let cookies = parseCookies();
let isRefreshing = false;
let failedRequestsQueue = [];

interface AxiosErrorResponse {
  code: string;
}

export const api = axios.create({
  baseURL: "http://localhost:3333",
  headers: {
    Authorization: `Bearer ${cookies['nextauth.token']}`
  }
});

api.interceptors.response.use(res => {
  return res;
}, (error: AxiosError<AxiosErrorResponse>) => {
  if (error.response.status === 401) {
    if (error.response.data?.code === "token.expired") {
      cookies = parseCookies();
      const { "nextauth.refreshToken": refreshToken } = cookies;
      const originalConfig = error.config;

      if (!isRefreshing) {
        isRefreshing = true;

        api.post("/refresh", {
          refreshToken
        }).then(res => {
          const { token } = res.data;
          
          setCookie(undefined, "nextauth.token", token, {
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: "/"
          });
          setCookie(undefined, "nextauth.refreshToken", res.data.refreshToken, {
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: "/"
          });
  
          api.defaults.headers["Authorization"] = `Bearer ${token}`;

          failedRequestsQueue.forEach(req => req.onSuccess(token))
          failedRequestsQueue = [];
        }).catch(err => {
          failedRequestsQueue.forEach(req => req.onFailure(err));
          failedRequestsQueue = [];
        }).finally(() => {
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
          }
        });
      });
    } else {
      // Redirect to login
    }
  }
});