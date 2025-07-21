import axios from "axios";
import { User } from "./types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CRAM_BACKEND_URL,
  withCredentials: true, // 👈 важно — отправляет куки
});

export const getUserInfo = async (): Promise<User>  => {
   return api.get("/me");
}

export default api;