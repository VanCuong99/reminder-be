import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class RegisterDeviceTokenInput {
    @Field()
    @IsNotEmpty()
    @IsString()
    token: string;

    @Field()
    @IsNotEmpty()
    @IsString()
    deviceType: string;
}
