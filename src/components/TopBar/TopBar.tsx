import React from 'react';
import { serverPath, getUserImage } from '../../utils';
import { Icon, Popup, Button, Dropdown, Image } from 'semantic-ui-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { LoginModal } from '../Modal/LoginModal';
import { ProfileModal } from '../Modal/ProfileModal';

export class NewRoomButton extends React.Component<{
  user: firebase.User | undefined;
  size?: string;
  openNewTab?: boolean;
}> {
  createRoom = async () => {
    const uid = this.props.user?.uid;
    const token = await this.props.user?.getIdToken();
    const response = await window.fetch(serverPath + '/createRoom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        token,
      }),
    });
    const data = await response.json();
    const { name } = data;
    if (this.props.openNewTab) {
      window.open('/#' + name);
    } else {
      window.location.assign('/#' + name);
    }
  };
  render() {
    return (
      <Popup
        content="Create a new room with a random URL that you can share with friends"
        trigger={
          <Button
            color="blue"
            size={this.props.size as any}
            icon
            labelPosition="left"
            onClick={this.createRoom}
            className="toolButton button-style"
            fluid
          >
            <Icon name="certificate" />
            New Room
          </Button>
        }
      />
    );
  }
}

type SignInButtonProps = {
  user: firebase.User | undefined;
  fluid?: boolean;
};

export class SignInButton extends React.Component<SignInButtonProps> {
  public state = { isLoginOpen: false, isProfileOpen: false, userImage: null };

  async componentDidUpdate(prevProps: SignInButtonProps) {
    if (!prevProps.user && this.props.user) {
      this.setState({ userImage: await getUserImage(this.props.user) });
    }
  }

  facebookSignIn = async () => {
    const provider = new firebase.auth.FacebookAuthProvider();
    await firebase.auth().signInWithPopup(provider);
  };

  googleSignIn = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
  };

  signOut = () => {
    firebase.auth().signOut();
    window.location.reload();
  };

  render() {
    if (this.props.user) {
      return (
        <div
          style={{
            margin: '4px',
            width: '100px',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <Image
            avatar
            src={this.state.userImage}
            onClick={() => this.setState({ isProfileOpen: true })}
          />
          {this.state.isProfileOpen && this.props.user && (
            <ProfileModal
              user={this.props.user}
              userImage={this.state.userImage}
              close={() => this.setState({ isProfileOpen: false })}
            />
          )}
        </div>
      );
    }
    return (
      <React.Fragment>
        {this.state.isLoginOpen && (
          <LoginModal
            closeLogin={() => this.setState({ isLoginOpen: false })}
          />
        )}
        <Popup
          basic
          content="Sign in to set your name and picture!!"
          trigger={
            <Dropdown
              style={{ height: '36px' }}

              icon="sign in"
              labeled
              className="icon button-style"
              button
              text="Sign in"
              fluid={this.props.fluid}
            >
              <Dropdown.Menu>
                
                <Dropdown.Item onClick={this.googleSignIn}>
                  <Icon name="google" />
                  Google
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => this.setState({ isLoginOpen: true })}
                >
                  <Icon name="mail" />
                  Email
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          }
        />
      </React.Fragment>
    );
  }
}



export class TopBar extends React.Component<{
  user?: firebase.User;
  hideNewRoom?: boolean;
  hideSignin?: boolean;
  hideMyRooms?: boolean;
  isSubscriber: boolean;
  isCustomer: boolean;
}> {
  render() {
    return (
      <React.Fragment>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            padding: '1em',
            paddingBottom: '0px',
          }}
        >
          <a href="/" style={{ display: 'flex' }}>
      
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: '#2185d0',
                  fontSize: '30px',
                  lineHeight: '30px',
                }}
              >
                Sync
              </div>
              <div
                style={{
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: '#21ba45',
                  fontSize: '30px',
                  lineHeight: '30px',
                  marginLeft: 'auto',
                }}
              >
                Telly
              </div>
            </div>
          </a>
          
          <div
            className="mobileStack"
            style={{
              display: 'flex',
              marginLeft: 'auto',
              gap: '4px',
            }}
          >
            {!this.props.hideNewRoom && (
              <NewRoomButton user={this.props.user} openNewTab />
            )}
            
            
            {!this.props.hideSignin && <SignInButton user={this.props.user} />}
          </div>
        </div>
      </React.Fragment>
    );
  }
}
