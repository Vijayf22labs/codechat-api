import type { ServiceResponse } from "@/common/models/serviceResponse";
import { app } from "@/server";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { Iinstance } from "../whatsappInterface";
const instances = {
  _id: "67d9a8fc-da1f-448a-a90a-b3023bf99a72",
  mobile_number: "12340090",
  status: "close",
};

describe("Whatsapp API Endpoints", () => {
  describe("POST /whatsapp/init", () => {
    it("should return a success response with connect instance details", async () => {
      const instanceName = "0587c688-043d-4ec4-9169-75737961ff00";
      const description = "Test instance description";
      const response = await request(app)
        .post("/whatsapp/init")
        .send({ instanceName, description })
        .set("Accept", "application/json");
      expect(response.status).toEqual(StatusCodes.OK);
      expect(response.body.success).toBeTruthy();
      expect(response.body.responseObject).toHaveProperty("base64");
    });
  });
});
