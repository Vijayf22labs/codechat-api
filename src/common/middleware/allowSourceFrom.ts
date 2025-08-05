import type { NextFunction, Request, Response } from "express";
import { ForbiddenException } from "../exception";

export const allowSourceFrom = (sources: string[] = ['web', 'pwa'], operatingSystems: string[] = ['ios', "android"]) => (req: Request, res: Response, next: NextFunction) => {
    const { 'x-source': source, 'x-mobile-os': mobileOs } = req.headers;
    try {
        if (!source || !sources.includes(source))  {
            throw new ForbiddenException("Invalid Source");
        }
        console.log(source)
        if (source === 'pwa' && (!mobileOs || !operatingSystems.includes(mobileOs)))  {
            throw new ForbiddenException("Invalid OS");
        }
        next();
    } catch (error) {
        next(error);
    }
};
