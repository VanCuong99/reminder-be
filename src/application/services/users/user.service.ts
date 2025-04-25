import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../domain/entities/user.entity';
import { CreateUserInput } from '../../../presentation/graphql/types/user/inputs/create-user.input';
import { UpdateUserInput } from '../../../presentation/graphql/types/user/inputs/update-user.input';
import { PaginationInput } from '../../../shared/types/graphql/inputs/pagination.input';
import { IPaginatedType } from '../../../shared/types/graphql/outputs/pagination.response';
import * as bcrypt from 'bcryptjs';
import { BaseService } from '../base/base.service';

@Injectable()
export class UserService extends BaseService<User> {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {
        super(userRepository);
    }

    async findAll(pagination?: PaginationInput): Promise<IPaginatedType<User>> {
        return this.paginate(pagination);
    }

    async findOne(id: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID "${id}" not found`);
        }
        return user;
    }

    async create(createUserInput: CreateUserInput): Promise<User> {
        const hashedPassword = await bcrypt.hash(createUserInput.password, 10);
        const user = this.userRepository.create({
            ...createUserInput,
            password: hashedPassword,
        });
        return this.userRepository.save(user);
    }

    async update(id: string, updateUserInput: UpdateUserInput): Promise<User> {
        const user = await this.findOne(id);

        // Only hash password if it's being updated
        if (updateUserInput.password) {
            updateUserInput.password = await bcrypt.hash(updateUserInput.password, 10);
        }

        // Update only provided fields
        Object.assign(user, updateUserInput);

        return this.userRepository.save(user);
    }

    async findOneByEmail(email: string): Promise<User> {
        return this.userRepository.findOne({ where: { email } });
    }
}
