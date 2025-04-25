import { ObjectType } from '@nestjs/graphql';
import { UserType } from './user.type';
import { Paginated } from '../../../../../shared/types/graphql/outputs/pagination.response';

@ObjectType()
export class PaginatedUsersResponse extends Paginated(UserType) {}
