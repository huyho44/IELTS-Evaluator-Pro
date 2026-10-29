import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { AuthService} from '../auth/auth.service.js';
import { AccessService} from '../auth/access.service.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auth: AuthService,
    private readonly access: AccessService,
  )
  {}

  @Get()
  async findAll(@Headers('authorization') header?: string){
    const actor = await this.auth.authenticate(header);
    this.access.role(actor,'ADMIN');
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id:string,
    @Headers('authorization') header?: string,
  ){
    const actor = await this.auth.authenticate(header);

    if(actor.id !== id && !actor.roles.includes('ADMIN')){
      throw new ForbiddenException('You cannot access another account',);

    }

    return this.usersService.findOne(id);
  }
}
