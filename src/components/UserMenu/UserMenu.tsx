import React, { useState } from 'react';
import './UserMenu.css';
import { Popup, Button } from 'semantic-ui-react';

export const UserMenu = ({
  user,
  socket,
  userToManage,
  trigger,
  displayName,
  position,
  disabled,
}: {
  user?: firebase.User;
  socket: SocketIOClient.Socket;
  userToManage: string;
  trigger: any;
  icon?: string;
  displayName?: string;
  position?: any;
  disabled: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);
  return (
    <Popup
      className="userMenu"
      trigger={trigger}
      on="click"
      open={isOpen}
      onOpen={handleOpen}
      onClose={handleClose}
      position={position}
      disabled={disabled}
    >
      <div className="userMenuHeader">{displayName}</div>
      <div className="userMenuContent">
        <Button
          content="Kick"
          negative
          icon="ban"
          onClick={async () => {
            const token = await user?.getIdToken();
            socket.emit('kickUser', {
              userToBeKicked: userToManage,
              uid: user?.uid,
              token,
            });
            handleClose();
          }}
        />
      </div>
    </Popup>
  );
};
