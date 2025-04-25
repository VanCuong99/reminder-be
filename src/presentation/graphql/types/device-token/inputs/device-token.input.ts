import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class DeviceTokenInput {
    @Field()
    @IsNotEmpty()
    @IsString()
    token: string;

    @Field()
    @IsNotEmpty()
    @IsString()
    deviceType: string;
}
