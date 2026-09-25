import React, { useEffect, useState } from "react";
import {
	spaced_client,
	fetch_user, spaced_account } from "../appwrite/service";
import { History } from "./utils";
import { Button, Container, HStack, Icon, Spinner, Text, VStack } from "@chakra-ui/react";
import { Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import store from "../storage";
import { Profile } from "./profile";
import { LibraryPage } from "./library";
import { GraphPage } from "./graph";

export async function loginGoogle(){
	try {
		const baseUrl = window.location.origin
		await spaced_account.createOAuth2Token(
			// @ts-expect-error: google is valid here
			'google',
			`${baseUrl}/auth/callback`,
			`${baseUrl}/auth`,
		)
	} catch (e) {
		console.error(e);
		return;
	}
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null) as any;

  useEffect(() => {
    const completeAuth = async () => {
      const secret = searchParams.get('secret');
      const userId = searchParams.get('userId');
      if (!secret || !userId) {
        setError('Authentication failed. Missing credentials in callback URL.');
        setTimeout(() => navigate('/auth'), 3000);
        return;
      }
      try {
        await spaced_account.createSession(userId, secret);
				const u = await spaced_account.get()
				await store.dispatch({
					type: 'set_user',
					payload: [u, undefined],
				})
				
				fetch_user(spaced_account)
				navigate('/profile')
      } catch (err){
        console.error('Failed to create session:', err);
        setError('An error occurred during authentication. Please try again.');
        setTimeout(() => navigate('/profile'), 3000);
      }
    };

    completeAuth();
  }, [searchParams, navigate]);

  return (
    <div>
      {error ? (
        <>
          <h1>Authentication Error</h1>
          <p>{error}</p>
        </>
      ) : (
        <h1>Verifying your authentication...</h1>
      )}
    </div>
  );
};


export async function logOut(){
	try {
		await spaced_account.deleteSession('current');
		store.dispatch({
			type: 'set_user',
			payload: [undefined, undefined],
		})
		History.push('/login')
	} catch (error) {
		console.error('Ошибка при выходе:', error);
	}
};

export async function loginEmail(email: string, password: string) {
	try {
		await spaced_account.createEmailPasswordSession(email, password);
		const u = await fetch_user(spaced_account)
		store.dispatch({
			type: 'set_user',
			payload: [u, undefined],
		})
		History.push('/profile')
	} catch (e) {
		console.error(e);
		return
	}
};

function Auth() {
	const [authState,setAuthState]=useState('login');

	useEffect(() => {
		// for testing
		const searchParams = new URLSearchParams(window.location.search);
		if (searchParams.get('e2e_test_login') === 'true') {
			loginEmail('e2e@test.com', '12345678'); 
		}
	}, []);

	return (
		<>
			<VStack gap="5" mt={'100px'}>
				<Button
					mt={'-10px'}
					variant="outline"
					width="full"
					maxW="md"
					colorPalette="blue"
					borderRadius="md"
					onClick={async ()=>{
						await loginGoogle()
						fetch_user(spaced_account)
					}}
					>
					<HStack
						align="center"
						rounded='2xl'
						gapX={4}
						id={'google-login'}
						>
						<Icon as={FcGoogle} boxSize={5} />
						<Text>Continue with Google</Text>
					</HStack>
				</Button>
				{/* replace with SpLink */}
				<p>
					{`If you don't have an account you can `}
					<button
						onClick={()=>{
							if (authState==='login'){
								setAuthState('registration');
							}else{
								setAuthState('login');
							}
						}}
						>
						create a space account
					</button>
				</p>
			</VStack>

		</>
	);
}

class SpaceRouter extends React.Component<any,any> {
  constructor(props: any) {
    super(props);
    this.state = {
        client: spaced_client,
        account: spaced_account,
        user: store.getState().user,
        route: History.loc()
    };
		store.dispatch({
			type:'load_component',
			payload: {
				key:'SpaceRouter',
				component:this,
			}
		})
		this.init()
  }

	init() {
    const checkUser = async () => {
      try {
		const urlParams = new URLSearchParams(window.location.hash.substring(1));
        const secret = urlParams.get('secret');
        const userId = urlParams.get('userId');
		let u = null;
        if (secret && userId) {
          try {
            await this.state.account.createSession(userId, secret);
            window.location.hash = '';
          } catch (sessionError) {
            console.error('Session creation failed:', sessionError);
          }
        }
				u = await fetch_user(this.state.account)
				if (!u && History.loc() !== '/auth') {
					History.push('/auth')
				}
				if (u && History.loc() == '/auth') {
					History.push('/profile')
				}
      } catch (e:any) {
				console.error('e',e)
				History.push('/auth')
      }
    };

    return checkUser();
  };

  render() {
		if (!this.state.user) {
			return (
				<Container
					w={'100vw'}
					h={'100vh'}
					>
					<Routes>
						<Route
							path={'/auth'}
							element={
								<Auth/>
							}
						/>
						<Route path="/auth/callback" element={<AuthCallback />} />
						<Route path="/" element={<Navigate to="/auth" replace />} />
						<Route
							path={':route'}
							element={
								<span
									style={{
										width:'100vw',
										height:'100vh',
										display:'flex',
										flexDirection:'column',
										color: '#777',
										gap: '10px',
										alignItems:'center',
										justifyContent:'center'
									}}>
									Space
									<Spinner/>
								</span>
							}
						/>
					</Routes>
				</Container>
			)
		} else {
			return (
				<Routes>
					<Route path="/profile" element={
						<Profile preview={false}/>
						}
					/>
					<Route
						path=':route'
						element={
							<GraphPage mode={'page'}/>
						}
					/>
                    <Route
						path='/graphs'
						element={
                            <>
								<LibraryPage/>
							</>
						}
					/>
				</Routes>
			)
		}
  }
}

export default SpaceRouter;