import { PartialType } from "@nestjs/mapped-types";
import { CreateNotificationDto } from "./create-notification.dto";

export class UpdateNotificationDto extends PartialType(CreateNotificationDto){
    notificationId: number;
    userId: number;
}