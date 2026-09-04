import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  ChatGroupInputDto, ChatSearchDto, MessagesQueryDto, SendMessageDto,
} from './chat.dto'
import { ChatService } from './chat.service'

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  // GET /chat/groups?search=
  @Get('groups')
  @RequirePermission('chat.use')
  listGroups(@Query() query: ChatSearchDto) {
    return this.chat.listGroups(query.search)
  }

  // GET /chat/groups/:id/messages?since=
  @Get('groups/:id/messages')
  @RequirePermission('chat.use')
  messages(@Param() params: IdParamDto, @Query() query: MessagesQueryDto) {
    return this.chat.messages(params.id, query)
  }

  // POST /chat/groups/:id/messages
  @Post('groups/:id/messages')
  @RequirePermission('chat.use')
  send(@Param() params: IdParamDto, @Body() dto: SendMessageDto) {
    return this.chat.send(params.id, dto)
  }

  // POST /chat/groups/:id/read
  @Post('groups/:id/read')
  @RequirePermission('chat.use')
  markRead(@Param() params: IdParamDto) {
    return this.chat.markRead(params.id)
  }

  // POST /chat/groups
  @Post('groups')
  @RequirePermission('chat.use')
  createGroup(@Body() dto: ChatGroupInputDto) {
    return this.chat.createGroup(dto)
  }
}
